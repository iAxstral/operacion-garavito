// Verifica el stack sin desplegar nada (sintetiza la plantilla en memoria):
//   cd infra && npx ts-node test/verificar-stack.ts
// Necesita backend/target/*.jar y frontend/dist (los assets del stack).
import assert from 'node:assert/strict';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { GaravitoStack } from '../lib/garavito-stack';

const SECRETO = 'secreto-de-prueba-0123456789abcdef0123456789';
const env = { account: '111111111111', region: 'us-east-2' };

// 1. Sin secreto, no se puede sintetizar (ni desplegar).
delete process.env.GARAVITO_ORIGIN_SECRET;
assert.throws(() => new GaravitoStack(new App(), 'SinSecreto', { env }), /secreto de origen/);

// 2. Con secreto: CloudFront lo manda al backend y el EC2 lo exige.
const app = new App({ context: { originSecret: SECRETO } });
const template = Template.fromStack(new GaravitoStack(app, 'ConSecreto', { env }));

template.hasResourceProperties('AWS::CloudFront::Distribution', {
  DistributionConfig: Match.objectLike({
    Origins: Match.arrayWith([Match.objectLike({
      OriginCustomHeaders: [{ HeaderName: 'X-Origin-Verify', HeaderValue: SECRETO }],
    })]),
  }),
});

const policies = template.findResources('AWS::CloudFront::ResponseHeadersPolicy');
assert.equal(Object.keys(policies).length, 1, 'una politica de encabezados');
const security = Object.values(policies)[0].Properties.ResponseHeadersPolicyConfig.SecurityHeadersConfig;
assert.equal(security.StrictTransportSecurity.AccessControlMaxAgeSec, 365 * 24 * 3600);
assert.equal(security.FrameOptions.FrameOption, 'DENY');
assert.ok(security.ContentTypeOptions);
const csp = security.ContentSecurityPolicy.ContentSecurityPolicy;
for (const part of ["default-src 'self'", "script-src 'self'", 'connect-src', 'wss://www.operaciongaravito.me',
  "frame-ancestors 'none'", "object-src 'none'"]) {
  assert.ok(csp.includes(part), `la CSP deberia incluir ${part}: ${csp}`);
}
assert.ok(!csp.includes('__DOMINIO__'));

// Todas las rutas (frontend, /ws/*, /api/*) usan la politica.
const dist = Object.values(template.findResources('AWS::CloudFront::Distribution'))[0].Properties.DistributionConfig;
assert.ok(dist.DefaultCacheBehavior.ResponseHeadersPolicyId);
for (const behavior of dist.CacheBehaviors) {
  assert.ok(behavior.ResponseHeadersPolicyId, `${behavior.PathPattern} sin encabezados de seguridad`);
}

// El EC2 arranca con el secreto, la IP real de X-Forwarded-For y sin *.cloudfront.net.
const userData = JSON.stringify(template.findResources('AWS::EC2::Instance'));
const at = userData.indexOf('SECURITY_ORIGIN_SECRET');
assert.ok(userData.includes(`SECURITY_ORIGIN_SECRET=${SECRETO}`), userData.slice(Math.max(0, at - 80), at + 120));
assert.ok(userData.includes('SECURITY_TRUST_FORWARDED_FOR=true'));
assert.ok(!userData.includes('*.cloudfront.net'), 'WS_ALLOWED_ORIGINS no deberia aceptar cualquier CloudFront');

// El Security Group solo abre 8080 (el actuator escucha en 127.0.0.1:9091).
const ingress = JSON.stringify({
  ...template.findResources('AWS::EC2::SecurityGroup'),
  ...template.findResources('AWS::EC2::SecurityGroupIngress'),
});
assert.ok(ingress.includes('"FromPort":8080') && !ingress.includes('9091'), ingress);

console.log('stack ok: header secreto, encabezados de seguridad y CSP en todas las rutas');
