export type ScopeAuthenticationOptionsInput = {
  allowCredentials?: Array<{ id: string; type: "public-key"; transports?: AuthenticatorTransport[] }>;
  [key: string]: unknown;
};
export type ScopeAuthenticationOptionsToDeviceContext = { credentialId: string };
export function scopeAuthenticationOptionsToDevice<T extends ScopeAuthenticationOptionsInput>(options: T, context: ScopeAuthenticationOptionsToDeviceContext): T {
  const allowCredentials = options.allowCredentials;
  if (!allowCredentials || allowCredentials.length <= 1) return options;
  const matched = allowCredentials.find((descriptor) => descriptor.id === context.credentialId);
  if (!matched) return options;
  return { ...options, allowCredentials: [matched] };
}
