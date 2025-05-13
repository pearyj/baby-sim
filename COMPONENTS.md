# Components Organization

This document outlines the structure and organization of components in the Baby Raising Simulator application.

## Component Categories

### `/src/components/ui`
Generic, reusable UI components that have no specific domain knowledge and can be used across the entire application.

**Examples:**
- Button
- Input
- Modal
- Dropdown
- Card
- Toggle
- TextField

### `/src/components/layout`
Structural components that compose the main layout of pages and views.

**Examples:**
- Header
- Footer
- Sidebar
- PageContainer
- GridLayout
- MainSection

### `/src/components/elements`
Mid-level components that are more specific than UI components but still reusable across multiple features.

**Examples:**
- FormGroup
- SearchBar
- NotificationItem
- UserAvatar
- ProgressIndicator
- Timeline

### `/src/components/features`
Domain-specific components that are tied to particular features or business logic.

**Examples:**
- GameQuestion
- FeedbackDisplay
- HistoryTimeline
- StoryDialog
- CharacterCreation
- AgeTransition

## Other Key Directories

### `/src/pages`
Route-level components that represent entire screens or views. These typically compose components from other categories.

**Examples:**
- HomePage
- GamePage
- ResultsPage
- SettingsPage

### `/src/hooks`
Custom React hooks for shared stateful logic.

**Examples:**
- useGameState
- useLocalStorage
- useMediaQuery

### `/src/lib`
Utility functions, helpers, and services.

**Examples:**
- api.ts
- formatting.ts
- validation.ts
- gameLogic.ts

### `/src/types`
TypeScript type definitions for the application.

**Examples:**
- game.ts
- user.ts
- api.ts

### `/src/assets`
Static assets such as images, icons, and fonts.

## Component Design Guidelines

1. **Single Responsibility**: Each component should have a single responsibility.
2. **Composability**: Prefer composition over inheritance.
3. **Props Interface**: Define clear props interfaces for all components.
4. **Styling**: Use Tailwind CSS utility classes directly in JSX.
5. **State Management**: Keep state as close as possible to where it's used.
6. **Naming**: Use PascalCase for component files and exported components. 