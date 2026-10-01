// Existing routes retained as the full directory.
export const DIRECTORY = [
  { section: 'Today', items: [
    { href: '/admin/',                          label: 'Home', ic: 'home' },
    { href: '/admin/schedule/',                 label: 'Schedule', ic: 'calendar', roles: ['full'] },
    { href: '/admin/decisions/',                label: 'Decisions', ic: 'square-check', roles: ['full'] },
    { href: '/admin/vault/',                    label: 'Vault', ic: 'archive', roles: ['full'] },
    { href: '/admin/rituals/',                  label: 'Rituals', ic: 'repeat', roles: ['full'] },
  ]},
  { section: 'Grow', items: [
    { href: '/admin/content/',                  label: 'Content', ic: 'film', roles: ['full'] },
    { href: '/admin/people/',                   label: 'People in orbit', ic: 'users', roles: ['full'] },
    { href: '/admin/insights/',                 label: 'Insights', ic: 'chart-line', roles: ['full'] },
    { href: '/admin/earn/',                     label: 'Earn', ic: 'coins', roles: ['full'] },
  ]},
  { section: 'Money', items: [
    { href: '/admin/finance/',                  label: 'Overview', ic: 'dashboard' },
    { href: '/admin/finance/networth.html',     label: 'Net worth', ic: 'wallet', roles: ['full'] },
    { href: '/admin/finance/transactions.html', label: 'Transactions', ic: 'arrow-left-right' },
    { href: '/admin/finance/investments.html',  label: 'Investments', ic: 'trending-up', roles: ['full'] },
    { href: '/admin/finance/funding.html',      label: 'Funding', ic: 'landmark' },
    { href: '/admin/finance/tax.html',          label: 'Tax prep', ic: 'receipt', roles: ['full'] },
    { href: '/admin/finance/export.html',       label: 'Export', ic: 'download', roles: ['full'] },
  ]},
  { section: 'Health', items: [
    { href: '/admin/health/dashboard.html',     label: 'Health', ic: 'activity', roles: ['full'] },
    { href: '/admin/health/log.html',           label: 'Daily log', ic: 'clipboard', roles: ['full'] },
  ]},
  { section: 'PlugVerse', items: [
    { href: '/admin/plugverse/',                label: 'KPIs', ic: 'gauge' },
    { href: '/admin/plugverse/ops.html',        label: 'Ops', ic: 'workflow' },
    { href: '/admin/finance/plugverse.html',    label: 'P&L', ic: 'chart-column' },
    { href: '/admin/finance/fund.html',         label: '1789 Fund', ic: 'briefcase' },
  ]},
  { section: 'Life', items: [
    { href: '/admin/life/',                     label: 'Weekly review', ic: 'compass', roles: ['full'] },
    { href: '/admin/life/relationships.html',   label: 'Relationships', ic: 'heart', roles: ['full'] },
    { href: '/admin/life/music.html',           label: 'Music', ic: 'music', roles: ['full'] },
    { href: '/admin/academics/',                label: 'Academics', ic: 'graduation-cap', roles: ['full'] },
  ]},
  { section: 'Brand', items: [
    { href: '/admin/social/',                   label: 'Social', ic: 'chart-bar' },
    { href: '/admin/carousels/',                label: 'Carousels', ic: 'gallery', roles: ['full'] },
    { href: '/admin/brain/',                    label: 'Brain', ic: 'lightbulb', roles: ['full'] },
    { href: '/admin/playbook/',                 label: 'Playbook', ic: 'book-open' },
    { href: '/admin/contacts/',                 label: 'Contacts', ic: 'contact' },
    { href: '/admin/merch/',                    label: 'Merch', ic: 'shirt', roles: ['full'] },
  ]},
  { section: 'System', items: [
    { href: '/admin/integrations/',             label: 'Integrations', ic: 'plug', roles: ['full'] },
  ]},
];
