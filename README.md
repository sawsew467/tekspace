# SpeakPing Admin Dashboard

Admin Dashboard for SpeakPing - Language Learning App. Built with Vite, React, TanStack Router, and ShadcnUI.

## Tech Stack

| Category      | Technology                                                |
| ------------- | --------------------------------------------------------- |
| UI            | [ShadcnUI](https://ui.shadcn.com) (TailwindCSS + RadixUI) |
| Build Tool    | [Vite](https://vitejs.dev/)                               |
| Routing       | [TanStack Router](https://tanstack.com/router/latest)     |
| Data Table    | [TanStack Table](https://tanstack.com/table/latest)       |
| Type Checking | [TypeScript](https://www.typescriptlang.org/)             |
| Icons         | [Lucide Icons](https://lucide.dev/icons/)                 |

## Run Locally

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev

# Build for production
pnpm run build
```

---

## Project Structure

```
src/
├── assets/              # Static assets (logo, icons)
├── components/          # Shared/Common components
│   ├── ui/              # ShadcnUI base components
│   ├── layout/          # Layout components (AppHeader, PageHeader, Sidebar...)
│   └── data-table/      # DataTable components
├── config/              # App configuration
├── context/             # React contexts
├── features/            # Feature modules (one folder per feature)
│   ├── analytics/
│   ├── dashboard/
│   ├── questions/
│   ├── recordings/
│   ├── users/
│   └── ...
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
├── routes/              # TanStack Router routes
│   ├── _authenticated/  # Protected routes
│   └── (auth)/          # Auth routes (sign-in, sign-up)
├── stores/              # State management
└── styles/              # Global styles
```

---

## Common Components

### 1. AppHeader

Shared header for all pages (Search, ThemeSwitch, ProfileDropdown).

**File:** `src/components/layout/app-header.tsx`

```tsx
import { AppHeader } from '@/components/layout/app-header'

// Basic usage
<AppHeader />

// With sticky header
<AppHeader fixed />

// With config drawer
<AppHeader showConfigDrawer />

// Combined
<AppHeader fixed showConfigDrawer />
```

### 2. PageHeader

Content area header (title, description, action buttons).

**File:** `src/components/layout/page-header.tsx`

```tsx
import { PageHeader } from '@/components/layout/page-header'

// Basic
<PageHeader title="Users" />

// With description
<PageHeader
  title="Users"
  description="Manage your users and their roles here."
/>

// With action buttons
<PageHeader title="Users" description="...">
  <Button>Add User</Button>
  <Button variant="outline">Export</Button>
</PageHeader>
```

### 3. DataTable

Generic table component with pagination, sorting, and filtering.

**File:** `src/components/data-table/data-table.tsx`

```tsx
import { DataTable, DataTableToolbar } from '@/components/data-table'

;<DataTable
  table={table} // TanStack Table instance
  columns={columns} // Column definitions
  toolbar={<DataTableToolbar />} // Optional toolbar
  bulkActions={<BulkActions />} // Optional bulk actions
  emptyMessage='No data found.' // Optional empty message
  showPagination={true} // Default: true
/>
```

**Sub-components:**

| Component                | Description                    |
| ------------------------ | ------------------------------ |
| `DataTableToolbar`       | Search input + faceted filters |
| `DataTablePagination`    | Pagination controls            |
| `DataTableColumnHeader`  | Sortable column header         |
| `DataTableFacetedFilter` | Multi-select filter dropdown   |
| `DataTableViewOptions`   | Column visibility toggle       |
| `DataTableBulkActions`   | Floating bulk actions toolbar  |

---

## Creating a New Feature Module

### Step 1: Create folder structure

```
src/features/questions/
├── index.tsx              # Main page component
├── components/
│   ├── questions-table.tsx
│   ├── questions-columns.tsx
│   ├── questions-dialogs.tsx
│   └── ...
└── data/
    ├── schema.ts          # Zod schema
    └── data.ts            # Static data/options
```

### Step 2: Create route

```tsx
// src/routes/_authenticated/questions/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import Questions from '@/features/questions'

export const Route = createFileRoute('/_authenticated/questions/')({
  component: Questions,
})
```

### Step 3: Create page component

```tsx
// src/features/questions/index.tsx
import { AppHeader } from '@/components/layout/app-header'
import { Main } from '@/components/layout/main'
import { PageHeader } from '@/components/layout/page-header'

export default function Questions() {
  return (
    <>
      <AppHeader />

      <Main>
        <PageHeader title='Questions' description='Manage practice questions'>
          <Button>Add Question</Button>
        </PageHeader>

        <QuestionsTable data={data} />
      </Main>
    </>
  )
}
```

### Step 4: Create DataTable (if needed)

```tsx
// src/features/questions/components/questions-table.tsx
import { useReactTable, ... } from '@tanstack/react-table'
import { DataTable, DataTableToolbar } from '@/components/data-table'
import { questionsColumns } from './questions-columns'

export function QuestionsTable({ data }) {
  const table = useReactTable({
    data,
    columns: questionsColumns,
    // ... config
  })

  return (
    <DataTable
      table={table}
      columns={questionsColumns}
      toolbar={
        <DataTableToolbar
          table={table}
          searchKey="question"
          filters={[
            { columnId: 'difficulty', title: 'Difficulty', options: [...] },
          ]}
        />
      }
    />
  )
}
```

### Step 5: Define columns

```tsx
// src/features/questions/components/questions-columns.tsx
import { type ColumnDef } from '@tanstack/react-table'
import { DataTableColumnHeader } from '@/components/data-table'

export const questionsColumns: ColumnDef<Question>[] = [
  {
    id: 'select',
    header: ({ table }) => <Checkbox ... />,
    cell: ({ row }) => <Checkbox ... />,
  },
  {
    accessorKey: 'question',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Question" />
    ),
    cell: ({ row }) => <span>{row.getValue('question')}</span>,
  },
  {
    accessorKey: 'difficulty',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Difficulty" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.difficulty}>
        {row.original.difficulty}
      </Badge>
    ),
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    id: 'actions',
    cell: ({ row }) => <RowActions row={row} />,
  },
]
```

---

## URL State Sync for DataTable

Use `useTableUrlState` hook to sync pagination and filters with URL.

```tsx
import { useTableUrlState } from '@/hooks/use-table-url-state'

const {
  columnFilters,
  onColumnFiltersChange,
  pagination,
  onPaginationChange,
  ensurePageInRange,
} = useTableUrlState({
  search,
  navigate,
  pagination: { defaultPage: 1, defaultPageSize: 10 },
  columnFilters: [
    { columnId: 'status', searchKey: 'status', type: 'array' },
    { columnId: 'name', searchKey: 'name', type: 'string' },
  ],
})
```

---

## Conventions

### File naming

- Components: `kebab-case.tsx` (e.g., `page-header.tsx`)
- Types/Schema: `schema.ts`, `types.ts`

### Import paths

- Use `@/` alias for absolute imports from `src/`

### Component structure

```tsx
// 1. Imports
import { ... } from '@/components/...'

// 2. Types
type Props = { ... }

// 3. Component
export function MyComponent({ ... }: Props) {
  // hooks
  // handlers
  // render
}
```

---

## Features Overview

| Feature       | Status      | Description                    |
| ------------- | ----------- | ------------------------------ |
| Dashboard     | Done        | Overview stats and charts      |
| Users         | Done        | User management with DataTable |
| Analytics     | Coming soon | Usage statistics               |
| Questions     | Coming soon | Practice questions management  |
| Recordings    | Coming soon | User audio recordings          |
| Subscriptions | Coming soon | RevenueCat subscriptions       |
| Notifications | Coming soon | Push notifications             |
| Quotas        | Coming soon | Daily usage limits             |
| Settings      | Done        | User settings                  |
