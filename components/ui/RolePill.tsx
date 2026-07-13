import { cn, roleBadgeClasses } from '@/lib/ui/tokens'

/**
 * Team-role badge (MEMBER / MANAGER / ADMIN / SUPERADMIN). Replaces the pill
 * markup duplicated in teams/page, TeamManagement, and AdminMembersView.
 */
export function RolePill({ role, className }: { role: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest',
        roleBadgeClasses(role),
        className
      )}
    >
      {role}
    </span>
  )
}
