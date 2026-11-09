import type { PluginClientContext } from "@getpaseo/plugin/client";

import { MagpieManagerPanel } from "./client/panel";

export default function contribute(client: PluginClientContext) {
  // Full screen (works from the sidebar, without opening an agent)
  client.addScreen({
    id: "magpie-manager",
    title: "Magpie",
    Component: MagpieManagerPanel,
  });

  // Sidebar entry — visible in the left rail at the top level
  client.addSidebarHeaderItem({
    id: "magpie-manager",
    title: "Magpie",
    Component: ({ openScreen }) => null,
  });

  // Workspace panel inside an agent session
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
