"use client";

import Link from "next/link";
import type { VaultAdminPageProps } from "@tgoliveira/vault-core/react";
import {
  VaultAdminConfigPage,
  VaultAdminCryptoPolicyPage,
  VaultAdminEnvTemplatePage,
  VaultAdminPanelPage,
  VaultAdminPasswordPolicyPage,
  VaultAdminProfilePage,
  VaultAdminSecurityPage,
  VaultAdminSessionPage,
} from "@tgoliveira/vault-core/react";

type AdminClientProps = Pick<
  VaultAdminPageProps,
  "config" | "env" | "adminOverrides" | "configApiBase"
>;

function withLink(props: AdminClientProps): VaultAdminPageProps {
  return { ...props, LinkComponent: Link };
}

export function VaultAdminPanelClient(props: AdminClientProps) {
  return <VaultAdminPanelPage {...withLink(props)} />;
}

export function VaultAdminConfigClient(props: AdminClientProps) {
  return <VaultAdminConfigPage {...withLink(props)} />;
}

export function VaultAdminEnvTemplateClient(props: AdminClientProps) {
  return <VaultAdminEnvTemplatePage {...withLink(props)} />;
}

export function VaultAdminCryptoPolicyClient(props: AdminClientProps) {
  return <VaultAdminCryptoPolicyPage {...withLink(props)} />;
}

export function VaultAdminProfileClient(props: AdminClientProps) {
  return <VaultAdminProfilePage {...withLink(props)} />;
}

export function VaultAdminSessionClient(props: AdminClientProps) {
  return <VaultAdminSessionPage {...withLink(props)} />;
}

export function VaultAdminPasswordPolicyClient(props: AdminClientProps) {
  return <VaultAdminPasswordPolicyPage {...withLink(props)} />;
}

export function VaultAdminSecurityClient(props: AdminClientProps) {
  return <VaultAdminSecurityPage {...withLink(props)} />;
}
