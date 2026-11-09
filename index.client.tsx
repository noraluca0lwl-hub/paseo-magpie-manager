import type { PluginClientContext } from "@getpaseo/plugin/client";

import { MagpieManagerPanel } from "./client/panel";

export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "magpie-manager",
    title: "Magpie",
    icon: "Sparkles",
    context: "agent",
    Component: MagpieManagerPanel,
  });
  client.addCommandCenterItem({
    id: "open-magpie-manager",
    title: "Magpie Manager",
    icon: "Sparkles",
    keywords: ["magpie", "provider", "relay", "中转"],
    context: "agent",
    onSelect: ({ openPanel }) => {
      openPanel("magpie-manager");
    },
  });
  return () => {};
}
