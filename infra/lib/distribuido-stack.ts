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
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as targets from 'aws-cdk-lib/aws-elasticloadbalancingv2-targets';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as elasticache from 'aws-cdk-lib/aws-elasticache';
import { monitoringCommands } from './garavito-stack';

const ROOT = path.join(__dirname, '..', '..');
const JAR = path.join(ROOT, 'backend', 'target', 'operacion-garavito-0.0.1-SNAPSHOT.jar');
const FRONTEND_DIST = path.join(ROOT, 'frontend', 'dist');
const MONITORING = path.join(ROOT, 'monitoring');
const CLOUDFRONT_PREFIX_LIST = 'pl-b6a144df';
const NODOS = 2;
const PUERTO_APP = 8080;
const PUERTO_ACTUATOR = 9091;

/**
 * Despliegue distribuido (docs/DISPONIBILIDAD.md): cada componente en su propio
 * servidor administrado o maquina, y el backend escalado horizontalmente detras de un
 * balanceador.
 *
 *   CloudFront ─┬─ /*            → S3 (frontend)
 *               ├─ /ws/*, /api/* → ALB → nodo 1 (zona A) / nodo 2 (zona B)
 *               ├─ /n1/*, /n2/*  → cada nodo directo (LOBBY_REDIRECT: la sala vive en un nodo)
 *               └─ /grafana/*    → EC2 de monitoreo (Prometheus + Grafana)
 *   Nodos → RDS PostgreSQL (historial y ranking) y ElastiCache Redis (registro sala → nodo)
 *
 * Es un stack aparte del juego publicado (OperacionGaravito): desplegarlo o borrarlo no
 * toca esa maquina ni su base.
 */
export class DistribuidoStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const secreto = this.node.tryGetContext('originSecret') ?? process.env.GARAVITO_ORIGIN_SECRET;
    if (typeof secreto !== 'string' || !/^[A-Za-z0-9_-]{32,128}$/.test(secreto)) {
      throw new Error('Falta GARAVITO_ORIGIN_SECRET (ver infra/README.md).');
    }

    const vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', { isDefault: true });
    const subredes = vpc.publicSubnets;

    // --- Grupos de seguridad: cada componente solo acepta a quien lo usa ---------------
    const albSg = new ec2.SecurityGroup(this, 'AlbSg', { vpc, allowAllOutbound: true });
    albSg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(80), 'CloudFront al ALB');
    // La lista de CloudFront ocupa ~55 reglas de 60: un grupo solo para ella.
    const nodoCdnSg = new ec2.SecurityGroup(this, 'NodoCdnSg', { vpc, allowAllOutbound: true });
    nodoCdnSg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(PUERTO_APP), 'CloudFront directo (/n1, /n2)');
    const monitorSg = new ec2.SecurityGroup(this, 'MonitorSg', { vpc, allowAllOutbound: true });
    monitorSg.addIngressRule(ec2.Peer.prefixList(CLOUDFRONT_PREFIX_LIST), ec2.Port.tcp(3000), 'CloudFront a Grafana');
    const nodoSg = new ec2.SecurityGroup(this, 'NodoSg', { vpc, allowAllOutbound: true });
    nodoSg.addIngressRule(albSg, ec2.Port.tcp(PUERTO_APP), 'ALB a la aplicacion');
    nodoSg.addIngressRule(albSg, ec2.Port.tcp(PUERTO_ACTUATOR), 'ALB: chequeo de salud');
    nodoSg.addIngressRule(monitorSg, ec2.Port.tcp(PUERTO_ACTUATOR), 'Prometheus lee /actuator/prometheus');
    const datosSg = new ec2.SecurityGroup(this, 'DatosSg', { vpc, allowAllOutbound: false });
    datosSg.addIngressRule(nodoSg, ec2.Port.tcp(5432), 'Nodos a PostgreSQL');
    datosSg.addIngressRule(nodoSg, ec2.Port.tcp(6379), 'Nodos a Redis');

    // --- Base de datos: RDS PostgreSQL, su propio servidor -----------------------------
    const db = new rds.DatabaseInstance(this, 'Postgres', {
      engine: rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_16 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.MICRO),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      publiclyAccessible: false,
      securityGroups: [datosSg],
      databaseName: 'operaciongaravito',
      credentials: rds.Credentials.fromGeneratedSecret('garavito'),
      allocatedStorage: 20,
      storageEncrypted: true,
      multiAz: false,
      backupRetention: Duration.days(1),
      deletionProtection: false,
      removalPolicy: RemovalPolicy.SNAPSHOT,
    });

    // --- Redis: ElastiCache, registro sala -> nodo compartido por los nodos -------------
    const redisSubredes = new elasticache.CfnSubnetGroup(this, 'RedisSubredes', {
      description: 'Subredes de Redis de Operacion Garavito',
      subnetIds: subredes.map((s) => s.subnetId),
    });
    const redis = new elasticache.CfnCacheCluster(this, 'Redis', {
      engine: 'redis',
      cacheNodeType: 'cache.t4g.micro',
      numCacheNodes: 1,
      cacheSubnetGroupName: redisSubredes.ref,
      vpcSecurityGroupIds: [datosSg.securityGroupId],
    });

    // --- Frontend y CloudFront ---------------------------------------------------------
    const sitio = new s3.Bucket(this, 'Frontend', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const alb = new elbv2.ApplicationLoadBalancer(this, 'Balanceador', {
      vpc,
      internetFacing: true,
      securityGroup: albSg,
      // Las partidas tienen el WebSocket abierto minutos sin mensajes HTTP nuevos.
      idleTimeout: Duration.seconds(3600),
    });
    // CloudFront ya agrego la IP real al final de X-Forwarded-For: el ALB no agrega la suya.
    alb.setAttribute('routing.http.xff_header_processing.mode', 'preserve');

    const ipNodo = Array.from({ length: NODOS }, (_, i) => new ec2.CfnEIP(this, `IpNodo${i + 1}`));
    const ipMonitor = new ec2.CfnEIP(this, 'IpMonitor');
    const dnsDe = (eip: ec2.CfnEIP) => Fn.join('', [
      'ec2-', Fn.join('-', Fn.split('.', eip.attrPublicIp)), `.${this.region}.compute.amazonaws.com`,
    ]);
    const encabezadoOrigen = { 'X-Origin-Verify': secreto };
    const haciaBackend = (origin: cloudfront.IOrigin, funciones?: cloudfront.FunctionAssociation[]): cloudfront.BehaviorOptions => ({
      origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      functionAssociations: funciones,
    });
    // /n1/ws/... -> /ws/... en el nodo 1. /actuator nunca se publica.
    const quitarPrefijo = new cloudfront.Function(this, 'QuitarPrefijoNodo', {
      code: cloudfront.FunctionCode.fromInline(`function handler(event) {
  var request = event.request;
  request.uri = request.uri.replace(/^\\/n[0-9]+/, '');
  if (request.uri === '') request.uri = '/';
  if (request.uri.indexOf('/actuator') === 0) {
    return { statusCode: 403, statusDescription: 'Forbidden' };
  }
  return request;
}`),
    });
    const funcionesNodo = [{ function: quitarPrefijo, eventType: cloudfront.FunctionEventType.VIEWER_REQUEST }];

    const porNodo: Record<string, cloudfront.BehaviorOptions> = {};
    ipNodo.forEach((eip, i) => {
      porNodo[`/n${i + 1}/*`] = haciaBackend(new origins.HttpOrigin(dnsDe(eip), {
        protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
        httpPort: PUERTO_APP,
        customHeaders: encabezadoOrigen,
      }), funcionesNodo);
    });
    const albOrigen = new origins.HttpOrigin(alb.loadBalancerDnsName, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      customHeaders: encabezadoOrigen,
    });
    const grafanaOrigen = new origins.HttpOrigin(dnsDe(ipMonitor), {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
      httpPort: 3000,
    });

    const cdn = new cloudfront.Distribution(this, 'Cdn', {
      comment: 'Operacion Garavito distribuido',
      defaultRootObject: 'index.html',
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(sitio),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/ws/*': haciaBackend(albOrigen),
        '/api/*': haciaBackend(albOrigen),
        ...porNodo,
        '/grafana/public/*': {
          origin: grafanaOrigen,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          compress: true,
        },
        '/grafana/*': {
          origin: grafanaOrigen,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER,
        },
      },
    });
    const urlPublica = `https://${cdn.distributionDomainName}`;

    new s3deploy.BucketDeployment(this, 'FrontendFiles', {
      sources: [s3deploy.Source.asset(FRONTEND_DIST)],
      destinationBucket: sitio,
      distribution: cdn,
    });

    // --- Nodos del backend: misma imagen, uno por zona de disponibilidad ----------------
    const rol = new iam.Role(this, 'NodoRol', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    const jar = new s3assets.Asset(this, 'BackendJar', { path: JAR });
    jar.grantRead(rol);
    db.secret!.grantRead(rol);

    const nodos = ipNodo.map((eip, i) => {
      const nombre = `nodo-${i + 1}`;
      const userData = ec2.UserData.forLinux();
      userData.addCommands(
        'set -euxo pipefail',
        'fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
        'dnf install -y java-21-amazon-corretto-headless',
        'mkdir -p /opt/garavito',
        `aws s3 cp s3://${jar.s3BucketName}/${jar.s3ObjectKey} /opt/garavito/app.jar`,
        // Usuario y clave de RDS desde Secrets Manager (nunca en el codigo).
        `SECRETO=$(aws secretsmanager get-secret-value --region ${this.region} --secret-id ${db.secret!.secretArn} --query SecretString --output text)`,
        'DB_USER=$(echo "$SECRETO" | python3 -c \'import json,sys; print(json.load(sys.stdin)["username"])\')',
        'DB_PW=$(echo "$SECRETO" | python3 -c \'import json,sys; print(json.load(sys.stdin)["password"])\')',
        'cat > /opt/garavito/app.env <<EOF',
        'SPRING_PROFILES_ACTIVE=cluster',
        `SPRING_DATASOURCE_URL=jdbc:postgresql://${db.dbInstanceEndpointAddress}:5432/operaciongaravito`,
        'SPRING_DATASOURCE_USERNAME=$DB_USER',
        'SPRING_DATASOURCE_PASSWORD=$DB_PW',
        `REDIS_HOST=${redis.attrRedisEndpointAddress}`,
        // El cliente pasa a /n1 o /n2 cuando su sala vive en ese nodo (mismo dominio).
        `NODE_PUBLIC_URL=/n${i + 1}`,
        `NODE_NAME=${nombre}`,
        `WS_ALLOWED_ORIGINS=${urlPublica}`,
        `SECURITY_ORIGIN_SECRET=${secreto}`,
        'SECURITY_TRUST_FORWARDED_FOR=true',
        // El actuator en otro puerto, sin el filtro de origen: solo lo ven el ALB y Prometheus.
        `MANAGEMENT_SERVER_PORT=${PUERTO_ACTUATOR}`,
        'MANAGEMENT_SERVER_ADDRESS=0.0.0.0',
        'EOF',
        'chmod 600 /opt/garavito/app.env',
        'cat > /etc/systemd/system/garavito.service <<EOF',
        '[Unit]',
        'Description=Operacion Garavito backend',
        'After=network.target',
        '[Service]',
        'EnvironmentFile=/opt/garavito/app.env',
        'ExecStart=/usr/bin/java -Xmx1200m -jar /opt/garavito/app.jar',
        'Restart=always',
        '[Install]',
        'WantedBy=multi-user.target',
        'EOF',
        'systemctl daemon-reload',
        'systemctl enable --now garavito',
      );
      const nodo = new ec2.Instance(this, `Nodo${i + 1}`, {
        vpc,
        vpcSubnets: { subnets: [subredes[i % subredes.length]] },
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
        machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
        securityGroup: nodoSg,
        role: rol,
        userData,
        blockDevices: [{
          deviceName: '/dev/xvda',
          volume: ec2.BlockDeviceVolume.ebs(12, { volumeType: ec2.EbsDeviceVolumeType.GP3, encrypted: true }),
        }],
      });
      nodo.addSecurityGroup(nodoCdnSg);
      new ec2.CfnEIPAssociation(this, `IpNodo${i + 1}Asoc`, {
        allocationId: eip.attrAllocationId,
        instanceId: nodo.instanceId,
      });
      return nodo;
    });

    const listener = alb.addListener('Http', { port: 80, open: false });
    listener.addTargets('Nodos', {
      port: PUERTO_APP,
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: nodos.map((n) => new targets.InstanceTarget(n, PUERTO_APP)),
      healthCheck: {
        port: String(PUERTO_ACTUATOR),
        path: '/actuator/health',
        interval: Duration.seconds(10),
        healthyThresholdCount: 2,
        unhealthyThresholdCount: 2,
      },
      // Afinidad: los transportes de respaldo de SockJS hacen varias peticiones por sesion.
      stickinessCookieDuration: Duration.hours(1),
      deregistrationDelay: Duration.seconds(10),
    });

    // --- Monitoreo: Prometheus y Grafana en su propia maquina ---------------------------
    const monitorRol = new iam.Role(this, 'MonitorRol', {
      assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore')],
    });
    const configMonitoreo = new s3assets.Asset(this, 'MonitoringConfig', { path: MONITORING });
    configMonitoreo.grantRead(monitorRol);
    const monitorData = ec2.UserData.forLinux();
    monitorData.addCommands(
      'set -euxo pipefail',
      'fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile',
      'dnf install -y httpd-tools unzip',
      'mkdir -p /opt/garavito',
      ...monitoringCommands(configMonitoreo, urlPublica),
      // Este Prometheus no lee localhost: lee los dos nodos por su IP privada.
      'cat > /opt/monitoring/prometheus.aws.yml <<EOF',
      'global:',
      '  scrape_interval: 5s',
      'scrape_configs:',
      '  - job_name: garavito',
      '    metrics_path: /actuator/prometheus',
      '    static_configs:',
      ...nodos.flatMap((n, i) => [
        `      - targets: ["${n.instancePrivateIp}:${PUERTO_ACTUATOR}"]`,
        '        labels:',
        `          node: nodo-${i + 1}`,
      ]),
      'EOF',
      'systemctl restart prometheus',
    );
    const monitor = new ec2.Instance(this, 'Monitor', {
      vpc,
      vpcSubnets: { subnets: [subredes[0]] },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T4G, ec2.InstanceSize.SMALL),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({ cpuType: ec2.AmazonLinuxCpuType.ARM_64 }),
      securityGroup: monitorSg,
      role: monitorRol,
      userData: monitorData,
    });
    new ec2.CfnEIPAssociation(this, 'IpMonitorAsoc', { allocationId: ipMonitor.attrAllocationId, instanceId: monitor.instanceId });

    new CfnOutput(this, 'Url', { value: urlPublica });
    new CfnOutput(this, 'GrafanaUrl', { value: `${urlPublica}/grafana/` });
    new CfnOutput(this, 'BalanceadorDns', { value: alb.loadBalancerDnsName });
    new CfnOutput(this, 'NodosIds', { value: Fn.join(',', nodos.map((n) => n.instanceId)) });
    new CfnOutput(this, 'MonitorId', { value: monitor.instanceId });
    new CfnOutput(this, 'BaseDeDatos', { value: db.dbInstanceEndpointAddress });
    new CfnOutput(this, 'RedisEndpoint', { value: redis.attrRedisEndpointAddress });
  }
}
