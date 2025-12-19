import { Search, Upload, BarChart3, Bug, Globe, Settings, LucideIcon } from "lucide-react"

export interface MenuItem {
  title: string
  description?: string
  url: string
  icon: LucideIcon
}

export interface MenuGroup {
  title: string
  items: MenuItem[]
}

export const menuGroups: MenuGroup[] = [
  {
    title: "Home",
    items: [
      {
        title: "Dashboard",
        description: "Overview & Statistics",
        url: "/dashboard",
        icon: BarChart3,
      },
    ],
  },
  {
    title: "Discovery",
    items: [
      {
        title: "Search",
        description: "Search & Analyze Data",
        url: "/",
        icon: Search,
      },
      {
        title: "Asset Discovery",
        description: "Explore Footprint",
        url: "/domain-search",
        icon: Globe,
      },
    ],
  },
  {
    title: "Import",
    items: [
      {
        title: "Upload",
        description: "Upload & Process Files",
        url: "/upload",
        icon: Upload,
      },
      {
        title: "Sources",
        description: "Manage Data Sources",
        url: "/dashboard/sources",
        icon: Globe,
      },
      {
        title: "Debug ZIP",
        description: "Validate ZIP Files",
        url: "/debug-zip",
        icon: Bug,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "Settings",
        description: "Configure System",
        url: "/settings",
        icon: Settings,
      },
    ],
  },
]

export const getPageTitle = (pathname: string): string => {
  // Default title
  let title = "broń Vault"

  // Check strict matches first
  for (const group of menuGroups) {
    for (const item of group.items) {
      if (item.url === pathname) {
        return `${title} - ${item.title}`
      }
    }
  }

  // Handle special cases or sub-routes
  if (pathname.startsWith("/domain-search/")) {
    return `${title} - Asset Discovery`
  }

  if (pathname === "/login") {
    // Login usually doesn't show the header, but just in case
    return title
  }

  return title
}
