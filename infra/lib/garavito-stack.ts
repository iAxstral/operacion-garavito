import * as path from 'path';
import { CfnOutput, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';

const ROOT = path.join(__dirname, '..', '..');
const JAR = path.join(ROOT, 'backend', 'target', 'operacion-garavito-0.0.1-SNAPSHOT.jar');
const FRONTEND_DIST = path.join(ROOT, 'frontend', 'dist');

// Lista de IPs de CloudFront hacia los origenes (us-east-2).
const CLOUDFRONT_PREFIX_LIST = 'pl-b6a144df';

/**
 * Despliegue minimo: un EC2 (backend + PostgreSQL en la misma maquina) y el
 * frontend en S3, todo detras de una sola distribucion de CloudFront con HTTPS.
 */
export class GaravitoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // El backend solo recibe trafico de CloudFront; sin SSH (se entra por SSM).
    const sg = new ec2.SecurityGroup(this, 'BackendSg', { vpc, allowAllOutbound: true });
    sg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(8080), 'CloudFront');

    const role = new iam.Role(this, 'BackendRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    const jar = new s3assets.Asset(this, 'BackendJar', { path: JAR });
    jar.grantRead(role);

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euxo pipefail',
      'dnf install -y java-21-amazon-corretto-headless postgresql16-server',
      // PostgreSQL local, con clave aleatoria generada en la propia maquina.
      'postgresql-setup --initdb',
      "sed -i -E 's/^(host.*)(ident)$/\\1scram-sha-256/' /var/lib/pgsql/data/pg_hba.conf",
      'systemctl enable --now postgresql',
      'PW=$(openssl rand -hex 16)',
      `sudo -u postgres psql -c "CREATE USER garavito PASSWORD '$PW';" -c "CREATE DATABASE operaciongaravito OWNER garavito;"`,
      'mkdir -p /opt/garavito',
      `aws s3 cp s3://${jar.s3BucketName}/${jar.s3ObjectKey} /opt/garavito/app.jar`,
      'cat > /opt/garavito/app.env <<EOF',
      'SPRING_DATASOURCE_URL=jdbc:postgresql://127.0.0.1:5432/operaciongaravito',
      'SPRING_DATASOURCE_USERNAME=garavito',
      'SPRING_DATASOURCE_PASSWORD=$PW',
      'WS_ALLOWED_ORIGINS=https://*.cloudfront.net',
      'EOF',
      'chmod 600 /opt/garavito/app.env',
      'cat > /etc/systemd/system/garavito.service <<EOF',
      '[Unit]',
      'Description=Operacion Garavito backend',
      'After=network.target postgresql.service',
      '[Service]',
      'EnvironmentFile=/opt/garavito/app.env',
      'ExecStart=/usr/bin/java -Xmx900m -jar /opt/garavito/app.jar',
      'Restart=always',
      '[Install]',
      'WantedBy=multi-user.target',
      'EOF',
      'systemctl daemon-reload',
      'systemctl enable --now garavito',
    );

    const instance = new ec2.Instance(this, 'Backend', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup: sg,
      role,
      userData,
      // Un .jar nuevo recrea la maquina (y con ella la base de datos local).
      userDataCausesReplacement: true,
      blockDevices: [{
        deviceName: '/dev/xvda',
        volume: ec2.BlockDeviceVolume.ebs(20, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }),
      }],
    });

    // IP fija para que CloudFront no pierda el origen si la maquina se reinicia.
    const eip = new ec2.CfnEIP(this, 'BackendIp', { instanceId: instance.instanceId });
    const backendDns = Fn.join('', [
      'ec2-', Fn.join('-', Fn.split('.', eip.attrPublicIp)), `.${this.region}.compute.amazonaws.com`,
    ]);

    const site = new s3.Bucket(this, 'Frontend', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const backendOrigin = new origins.HttpOrigin(backendDns, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 8080,
    });
    const toBackend: cloudfront.BehaviorOptions = {
      origin: backendOrigin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
    };

    const cdn = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: { '/ws/*': toBackend, '/api/*': toBackend },
    });

    new s3deploy.BucketDeployment(this, 'FrontendFiles', {
      sources: [s3deploy.Source.asset(FRONTEND_DIST)],
      destinationBucket: site,
      distribution: cdn,
    });

    new CfnOutput(this, 'Url', { value: `https://${cdn.distributionDomainName}` });
    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
  }
}
