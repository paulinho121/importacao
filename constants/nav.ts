import {
  LayoutDashboard,
  ClipboardList,
  PackageSearch,
  Ship,
  Anchor,
  PackageCheck,
  Boxes,
  Building2,
  Users,
  BarChart3,
  Wallet,
  Settings,
  Warehouse,
  Archive,
  Search,
  type LucideIcon,
} from "lucide-react";

export interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  // Escondido dos menus (a rota continua existindo e o título do breadcrumb
  // segue funcionando). Para mostrar de novo, remova `hidden`.
  hidden?: boolean;
}

export interface NavGroup {
  label: string | null;
  items: NavLink[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Consulta de Itens", href: "/consulta", icon: Search },
    ],
  },
  {
    label: "Operações",
    items: [
      { label: "Pedidos de Compra", href: "/pedidos-compra", icon: ClipboardList },
      { label: "Em Importação (Externo)", href: "/em-importacao", icon: Warehouse, hidden: true },
      { label: "Processos", href: "/processos", icon: PackageSearch },
      { label: "Em Trânsito", href: "/processos?status=EM_TRANSITO", icon: Ship },
      { label: "Embarcados", href: "/processos?status=EMBARCADO", icon: Anchor },
      { label: "Em Estoque", href: "/processos?status=RECEBIDO", icon: PackageCheck },
      { label: "Finalizados", href: "/finalizados", icon: Archive },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { label: "Produtos", href: "/produtos", icon: Boxes },
      { label: "Fornecedores", href: "/fornecedores", icon: Building2 },
      { label: "Agentes de Carga", href: "/agentes", icon: Users },
    ],
  },
  {
    label: null,
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart3 },
      { label: "Financeiro", href: "/financeiro", icon: Wallet },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];
