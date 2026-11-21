import { CfnOutput, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

// Misma version que monitoring/docker-compose.yml.
const SONARQUBE_IMAGE = 'sonarqube:10.7-community';
const POSTGRES_IMAGE = 'postgres:16-alpine';

// Lista de IPs de CloudFront hacia los origenes (us-east-2), igual que el juego.
const CLOUDFRONT_PREFIX_LIST = 'pl-b6a144df';

/**
 * SonarQube para el analisis del CI, en su propia maquina y su propia distribucion
 * de CloudFront: es un stack aparte para que desplegarlo o apagarlo nunca recree la
 * maquina del juego (y con ella la base del ranking).
 *
 * t4g.small (2 GB) alcanza porque el analisis pesado corre en GitHub Actions; el
 * servidor solo recibe el reporte. Las claves y el token del CI se generan en la
 * maquina y quedan en /opt/sonar/sonar.env (se leen por SSM, ver infra/README.md).
 */
export class SonarStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // Solo CloudFront llega al puerto de SonarQube; sin SSH (se entra por SSM).
    const sg = new ec2.SecurityGroup(this, 'SonarSg', { vpc, allowAllOutbound: true });
    sg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(9000), 'CloudFront a SonarQube');

    const role = new iam.Role(this, 'SonarRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euxo pipefail',
      // 2 GB de swap: Elasticsearch, la web y el motor de SonarQube comparten 2 GB.
      'fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
      "echo '/swapfile none swap defaults 0 0' >> /etc/fstab",
      // Elasticsearch (dentro de SonarQube) no arranca sin estos limites.
      "printf 'vm.max_map_count=524288\\nfs.file-max=131072\\n' > /etc/sysctl.d/99-sonarqube.conf",
      'sysctl --system',
      'dnf install -y docker',
      'systemctl enable --now docker',
      'mkdir -p /opt/sonar && chmod 700 /opt/sonar',
      'DB_PW=$(openssl rand -hex 16)',
      // SonarQube pide 12+ caracteres con mayuscula, minuscula, numero y simbolo.
      'ADMIN_PW="Gv$(openssl rand -hex 10)#9"',
      'docker network create sonar',
      `docker run -d --name sonar-db --restart always --network sonar`
        + ' -e POSTGRES_USER=sonar -e POSTGRES_PASSWORD="$DB_PW" -e POSTGRES_DB=sonar'
        + ` -v sonar_db:/var/lib/postgresql/data ${POSTGRES_IMAGE}`,
      `docker run -d --name sonarqube --restart always --network sonar -p 9000:9000`
        + ' --ulimit nofile=131072:131072 --ulimit nproc=8192:8192'
        + ' -e SONAR_JDBC_URL=jdbc:postgresql://sonar-db:5432/sonar'
        + ' -e SONAR_JDBC_USERNAME=sonar -e SONAR_JDBC_PASSWORD="$DB_PW"'
        // Memoria ajustada para que todo quepa en 2 GB.
        + ' -e SONAR_WEB_JAVAOPTS="-Xmx384m -Xms128m"'
        + ' -e SONAR_CE_JAVAOPTS="-Xmx512m -Xms128m"'
        + ' -e SONAR_SEARCH_JAVAOPTS="-Xmx384m -Xms384m"'
        + ' -v sonarqube_data:/opt/sonarqube/data'
        + ' -v sonarqube_extensions:/opt/sonarqube/extensions'
        + ` -v sonarqube_logs:/opt/sonarqube/logs ${SONARQUBE_IMAGE}`,
      // Espera hasta 15 min a que SonarQube termine de arrancar.
      'for i in $(seq 1 180); do curl -fsS http://localhost:9000/api/system/status | grep -q \'"status":"UP"\' && break; sleep 5; done',
      // La clave por defecto (admin/admin) no puede quedar expuesta en internet.
      'curl -fsS -u admin:admin -X POST http://localhost:9000/api/users/change_password'
        + ' --data-urlencode login=admin --data-urlencode previousPassword=admin --data-urlencode "password=$ADMIN_PW"',
      // Token para GitHub Actions (secreto SONAR_TOKEN).
      'TOKEN=$(curl -fsS -u "admin:$ADMIN_PW" -X POST http://localhost:9000/api/user_tokens/generate'
        + ' -d name=github-ci -d type=GLOBAL_ANALYSIS_TOKEN'
        + ' | python3 -c \'import json,sys; print(json.load(sys.stdin)["token"])\')',
      'cat > /opt/sonar/sonar.env <<EOF',
      'SONAR_ADMIN_USER=admin',
      'SONAR_ADMIN_PASSWORD=$ADMIN_PW',
      'SONAR_DB_PASSWORD=$DB_PW',
      'SONAR_TOKEN=$TOKEN',
      'EOF',
      'chmod 600 /opt/sonar/sonar.env',
    );

    const instance = new ec2.Instance(this, 'Sonar', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup: sg,
      role,
      userData,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }),
      }],
    });

    // IP fija para que CloudFront no pierda el origen si la maquina se apaga y prende.
    const eip = new ec2.CfnEIP(this, 'SonarIp', { instanceId: instance.instanceId });
    const sonarDns = Fn.join('', [
      'ec2-', Fn.join('-', Fn.split('.', eip.attrPublicIp)), `.${this.region}.compute.amazonaws.com`,
    ]);

    const cdn = new cloudfront.Distribution(this, 'SonarCdn', {
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      comment: 'SonarQube de Operacion Garavito',
      defaultBehavior: {
        origin: new origins.HttpOrigin(sonarDns, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
          httpPort: 9000,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      },
    });

    new CfnOutput(this, 'SonarUrl', { value: `https://${cdn.distributionDomainName}` });
    new CfnOutput(this, 'SonarInstanceId', { value: instance.instanceId });
  }
}
