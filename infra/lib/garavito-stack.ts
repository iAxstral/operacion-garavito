import * as path from 'path';
import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3assets from 'aws-cdk-lib/aws-s3-assets';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';

const ROOT = path.join(__dirname, '..', '..');
const JAR = path.join(ROOT, 'backend', 'target', 'operacion-garavito-0.0.1-SNAPSHOT.jar');
const FRONTEND_DIST = path.join(ROOT, 'frontend', 'dist');
const MONITORING = path.join(ROOT, 'monitoring');

// Versiones de Prometheus y Grafana, las mismas que monitoring/docker-compose.yml.
const PROMETHEUS_VERSION = '2.54.1';
const GRAFANA_VERSION = '11.2.0';

// Lista de IPs de CloudFront hacia los origenes (us-east-2).
const CLOUDFRONT_PREFIX_LIST = 'pl-b6a144df';

// Dominio propio (DNS en Namecheap). El certificado vive en us-east-1, como exige
// CloudFront; se creo con la CLI porque la cuenta no permite CloudFormation alla.
const DOMAIN = 'www.operaciongaravito.me';
const CERTIFICATE_ARN =
  'arn:aws:acm:us-east-1:224772449836:certificate/b3c97791-79fe-4372-9039-9f5cf45e57ca';

/**
 * Despliegue minimo: un EC2 (backend + PostgreSQL + Prometheus + Grafana en la misma
 * maquina) y el frontend en S3, todo detras de una sola distribucion de CloudFront
 * con HTTPS.
 */
export class GaravitoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });

    // El backend solo recibe trafico de CloudFront; sin SSH (se entra por SSM).
    const sg = new ec2.SecurityGroup(this, 'BackendSg', { vpc, allowAllOutbound: true });
    sg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(8080), 'CloudFront');
    // La lista de CloudFront pesa ~55 reglas y un grupo admite 60: un grupo por puerto.
    const grafanaSg = new ec2.SecurityGroup(this, 'GrafanaSg', { vpc, allowAllOutbound: true });
    grafanaSg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(3000), 'CloudFront a Grafana');
    const prometheusSg = new ec2.SecurityGroup(this, 'PrometheusSg', { vpc, allowAllOutbound: true });
    prometheusSg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(9090), 'CloudFront a Prometheus');

    const role = new iam.Role(this, 'BackendRole', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });

    const jar = new s3assets.Asset(this, 'BackendJar', { path: JAR });
    jar.grantRead(role);
    // Configuracion de Prometheus, tableros y alertas de Grafana (carpeta monitoring/).
    const monitoring = new s3assets.Asset(this, 'MonitoringConfig', { path: MONITORING });
    monitoring.grantRead(role);

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      'set -euxo pipefail',
      // 2 GB de swap: Java, PostgreSQL, Prometheus y Grafana comparten 2 GB de RAM.
      'fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
      "echo '/swapfile none swap defaults 0 0' >> /etc/fstab",
      'dnf install -y java-21-amazon-corretto-headless postgresql16-server httpd-tools unzip',
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
      `WS_ALLOWED_ORIGINS=https://${DOMAIN},https://*.cloudfront.net`,
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
      ...monitoringCommands(monitoring, `https://${DOMAIN}`),
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

    instance.addSecurityGroup(grafanaSg);
    instance.addSecurityGroup(prometheusSg);

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

    const grafanaOrigin = new origins.HttpOrigin(backendDns, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 3000,
    });

    const cdn = new cloudfront.Distribution(this, 'Cdn', {
      defaultRootObject: 'index.html',
      domainNames: [DOMAIN],
      certificate: acm.Certificate.fromCertificateArn(this, 'Cert', CERTIFICATE_ARN),
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(site),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/ws/*': toBackend,
        '/api/*': toBackend,
        // Archivos estaticos de Grafana (~12 MB de JS, con hash en el nombre): CloudFront
        // los guarda comprimidos, asi la pagina no espera a la maquina. Va antes de
        // /grafana/* porque CloudFront usa la primera ruta que coincide.
        '/grafana/public/*': {
          origin: grafanaOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        // Grafana sirve desde /grafana/ (GF_SERVER_SERVE_FROM_SUB_PATH). Se le pasa el
        // Host original para que el chequeo CSRF del inicio de sesion lo acepte.
        '/grafana/*': {
          origin: grafanaOrigin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
        // Prometheus (con usuario y clave): su pagina y la escritura remota que usa k6.
        '/prometheus/*': {
          origin: new origins.HttpOrigin(backendDns, {
            protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
            httpPort: 9090,
          }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          // CloudFront solo reenvia el encabezado Authorization en un GET si esta en la
          // clave de cache; con TTL 0 igual no guarda nada.
          cachePolicy: new cloudfront.CachePolicy(this, 'ConAutorizacion', {
            headerBehavior: cloudfront.CacheHeaderBehavior.allowList('Authorization'),
            queryStringBehavior: cloudfront.CacheQueryStringBehavior.all(),
            cookieBehavior: cloudfront.CacheCookieBehavior.none(),
            minTtl: Duration.seconds(0),
            defaultTtl: Duration.seconds(0),
            maxTtl: Duration.seconds(1),
          }),
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        },
      },
    });

    new s3deploy.BucketDeployment(this, 'FrontendFiles', {
      sources: [s3deploy.Source.asset(FRONTEND_DIST)],
      destinationBucket: site,
      distribution: cdn,
    });

    new CfnOutput(this, 'Url', { value: `https://${DOMAIN}` });
    new CfnOutput(this, 'CloudFrontDomain', { value: cdn.distributionDomainName });
    new CfnOutput(this, 'InstanceId', { value: instance.instanceId });
    new CfnOutput(this, 'GrafanaUrl', { value: `https://${DOMAIN}/grafana/` });
    new CfnOutput(this, 'PrometheusUrl', { value: `https://${DOMAIN}/prometheus/` });
  }
}

/**
 * Prometheus y Grafana en la misma maquina. Van despues del backend: si alguna descarga
 * falla, el juego ya quedo arriba. Las claves se generan en la maquina y quedan en
 * /opt/garavito/monitoring.env (se leen por SSM, ver infra/README.md).
 */
function monitoringCommands(config: s3assets.Asset, publicUrl: string): string[] {
  const prom = `prometheus-${PROMETHEUS_VERSION}.linux-arm64`;
  return [
    `aws s3 cp s3://${config.s3BucketName}/${config.s3ObjectKey} /tmp/monitoring.zip`,
    'mkdir -p /opt/monitoring && unzip -o /tmp/monitoring.zip -d /opt/monitoring && chmod -R a+rX /opt/monitoring',
    'PROM_PW=$(openssl rand -hex 16)',
    'GF_PW=$(openssl rand -hex 12)',
    'cat > /opt/garavito/monitoring.env <<EOF',
    'GRAFANA_USER=admin',
    'GRAFANA_PASSWORD=$GF_PW',
    'PROMETHEUS_USER=garavito',
    'PROMETHEUS_PASSWORD=$PROM_PW',
    'EOF',
    'chmod 600 /opt/garavito/monitoring.env',

    // Prometheus
    `curl -fsSL https://github.com/prometheus/prometheus/releases/download/v${PROMETHEUS_VERSION}/${prom}.tar.gz | tar xz -C /opt`,
    `mv /opt/${prom} /opt/prometheus`,
    'useradd --system --no-create-home --shell /sbin/nologin prometheus',
    'mkdir -p /var/lib/prometheus && chown prometheus: /var/lib/prometheus',
    'cat > /opt/prometheus/web.yml <<EOF',
    'basic_auth_users:',
    '  garavito: $(htpasswd -nbBC 10 garavito "$PROM_PW" | cut -d: -f2)',
    'EOF',
    'chown prometheus: /opt/prometheus/web.yml && chmod 600 /opt/prometheus/web.yml',
    'cat > /etc/systemd/system/prometheus.service <<EOF',
    '[Unit]',
    'Description=Prometheus',
    'After=network.target',
    '[Service]',
    'User=prometheus',
    'ExecStart=/opt/prometheus/prometheus --config.file=/opt/monitoring/prometheus.aws.yml'
      + ' --storage.tsdb.path=/var/lib/prometheus --storage.tsdb.retention.time=30d --storage.tsdb.retention.size=4GB'
      + ' --web.config.file=/opt/prometheus/web.yml --web.enable-remote-write-receiver'
      + ` --web.external-url=${publicUrl}/prometheus/`,
    'Restart=always',
    '[Install]',
    'WantedBy=multi-user.target',
    'EOF',

    // Grafana, con los tableros y las alertas de monitoring/grafana
    `dnf install -y https://dl.grafana.com/oss/release/grafana-${GRAFANA_VERSION}-1.aarch64.rpm`,
    'cp -r /opt/monitoring/grafana/provisioning/. /etc/grafana/provisioning/',
    'mkdir -p /var/lib/grafana/dashboards && cp /opt/monitoring/grafana/dashboards/*.json /var/lib/grafana/dashboards/',
    'chown -R grafana: /var/lib/grafana',
    // Mismo uid "prometheus" que en local (lo usan tableros y alertas), pero por
    // localhost y con clave.
    'cat > /etc/grafana/provisioning/datasources/prometheus.yml <<EOF',
    'apiVersion: 1',
    'datasources:',
    '  - name: Prometheus',
    '    uid: prometheus',
    '    type: prometheus',
    '    access: proxy',
    '    url: http://localhost:9090/prometheus',
    '    isDefault: true',
    '    basicAuth: true',
    '    basicAuthUser: garavito',
    '    secureJsonData:',
    '      basicAuthPassword: $PROM_PW',
    'EOF',
    'chown root:grafana /etc/grafana/provisioning/datasources/prometheus.yml',
    'chmod 640 /etc/grafana/provisioning/datasources/prometheus.yml',
    'mkdir -p /etc/systemd/system/grafana-server.service.d',
    'cat > /etc/systemd/system/grafana-server.service.d/garavito.conf <<EOF',
    '[Service]',
    `Environment=GF_SERVER_ROOT_URL=${publicUrl}/grafana/`,
    'Environment=GF_SERVER_SERVE_FROM_SUB_PATH=true',
    'Environment=GF_SECURITY_ADMIN_USER=admin',
    'Environment=GF_SECURITY_ADMIN_PASSWORD=$GF_PW',
    'Environment=GF_SECURITY_COOKIE_SECURE=true',
    // Cualquiera puede ver los tableros; editarlos pide la clave de admin.
    'Environment=GF_AUTH_ANONYMOUS_ENABLED=true',
    'Environment=GF_AUTH_ANONYMOUS_ORG_ROLE=Viewer',
    'Environment=GF_ANALYTICS_REPORTING_ENABLED=false',
    'Environment=GF_ANALYTICS_CHECK_FOR_UPDATES=false',
    'EOF',
    'chmod 600 /etc/systemd/system/grafana-server.service.d/garavito.conf',
    'systemctl daemon-reload',
    'systemctl enable --now prometheus grafana-server',
  ];
}
