import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";

import { MagpieManagerPanel } from "./client/panel";

function SidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Sparkles"
      label="Magpie"
      active={currentScreen?.screenId === "magpie-manager"}
      onPress={() => openScreen({ screenId: "magpie-manager" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  // Full screen — reachable from the sidebar without opening an agent
  client.addScreen({
    id: "magpie-manager",
    title: "Magpie",
    Component: MagpieManagerPanel,
  });

  // Sidebar entry in the left rail
  client.addSidebarHeaderItem({
    id: "magpie-manager",
    title: "Magpie",
    Component: SidebarItem,
  });

  // Workspace panel inside an agent session
  client.addWorkspacePanel({
    id: "magpie-manager-panel",
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
    context: "global",
    onSelect: (ctx) => {
      ctx.openScreen({ screenId: "magpie-manager" });
    },
  });
  return () => {};
}
