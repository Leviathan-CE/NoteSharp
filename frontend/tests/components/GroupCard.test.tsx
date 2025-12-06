import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { GroupCard } from '../../src/components/GroupCard';
import type { Group, ViewMode } from '../../src/types/group';

const mockGroup: Group = {
  id: 'group-1',
  title: 'Test Group',
  expanded: true,
  order: 0,
  boardId: 'board-1',
  ownerId: 'user-1',
  createdAt: new Date(),
  updatedAt: new Date()
};

const defaultProps = {
  group: mockGroup,
  viewMode: 'list' as ViewMode,
  onToggleExpand: vi.fn(),
  onRename: vi.fn(),
  onDelete: vi.fn(),
  onCardDrop: vi.fn(),
  cardCount: 3
};

const renderWithDnd = (component: React.ReactElement) => {
  return render(
    <DndProvider backend={HTML5Backend}>
      {component}
    </DndProvider>
  );
};

describe('GroupCard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render group title and card count', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      expect(screen.getByText('Test Group')).toBeInTheDocument();
      expect(screen.getByText('(3 cards)')).toBeInTheDocument();
    });

    it('should show singular "card" for count of 1', () => {
      renderWithDnd(<GroupCard {...defaultProps} cardCount={1} />);
      
      expect(screen.getByText('(1 card)')).toBeInTheDocument();
    });

    it('should render children when expanded', () => {
      renderWithDnd(
        <GroupCard {...defaultProps}>
          <div>Test Child</div>
        </GroupCard>
      );
      
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('should not show children when collapsed', () => {
      const collapsedGroup = { ...mockGroup, expanded: false };
      renderWithDnd(
        <GroupCard {...defaultProps} group={collapsedGroup}>
          <div>Test Child</div>
        </GroupCard>
      );
      
      // Children are conditionally rendered, so they should not be in DOM when collapsed
      const child = screen.queryByText('Test Child');
      expect(child).not.toBeInTheDocument();
    });

    it('should show empty state when no cards', () => {
      renderWithDnd(<GroupCard {...defaultProps} cardCount={0} />);
      
      expect(screen.getByText('Drop cards here')).toBeInTheDocument();
    });
  });

  describe('Expand/Collapse', () => {
    it('should call onToggleExpand when expand button is clicked', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const expandButton = screen.getByLabelText('Collapse group');
      fireEvent.click(expandButton);
      
      expect(defaultProps.onToggleExpand).toHaveBeenCalledWith('group-1', false);
    });

    it('should show correct aria-label based on expanded state', () => {
      const { rerender } = renderWithDnd(<GroupCard {...defaultProps} />);
      
      expect(screen.getByLabelText('Collapse group')).toBeInTheDocument();
      
      const collapsedGroup = { ...mockGroup, expanded: false };
      rerender(
        <DndProvider backend={HTML5Backend}>
          <GroupCard {...defaultProps} group={collapsedGroup} />
        </DndProvider>
      );
      
      expect(screen.getByLabelText('Expand group')).toBeInTheDocument();
    });
  });

  describe('Rename', () => {
    it('should enter edit mode when title is clicked', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const title = screen.getByText('Test Group');
      fireEvent.click(title);
      
      expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
    });

    it('should call onRename when Enter is pressed', async () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const title = screen.getByText('Test Group');
      fireEvent.click(title);
      
      const input = screen.getByDisplayValue('Test Group');
      fireEvent.change(input, { target: { value: 'Updated Group' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(defaultProps.onRename).toHaveBeenCalledWith('group-1', 'Updated Group');
      });
    });

    it('should cancel edit when Escape is pressed', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const title = screen.getByText('Test Group');
      fireEvent.click(title);
      
      const input = screen.getByDisplayValue('Test Group');
      fireEvent.change(input, { target: { value: 'Updated Group' } });
      fireEvent.keyDown(input, { key: 'Escape' });
      
      expect(screen.getByText('Test Group')).toBeInTheDocument();
      expect(defaultProps.onRename).not.toHaveBeenCalled();
    });

    it('should not call onRename if title is unchanged', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const title = screen.getByText('Test Group');
      fireEvent.click(title);
      
      const input = screen.getByDisplayValue('Test Group');
      fireEvent.blur(input);
      
      expect(defaultProps.onRename).not.toHaveBeenCalled();
    });

    it('should trim whitespace from new title', async () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const title = screen.getByText('Test Group');
      fireEvent.click(title);
      
      const input = screen.getByDisplayValue('Test Group');
      fireEvent.change(input, { target: { value: '  Updated Group  ' } });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      await waitFor(() => {
        expect(defaultProps.onRename).toHaveBeenCalledWith('group-1', 'Updated Group');
      });
    });
  });

  describe('Menu', () => {
    it('should open menu when menu button is clicked', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const menuButton = screen.getByLabelText('Group menu');
      fireEvent.click(menuButton);
      
      expect(screen.getByText('Rename')).toBeInTheDocument();
      expect(screen.getByText('Delete Group')).toBeInTheDocument();
    });

    it('should close menu when clicking outside', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const menuButton = screen.getByLabelText('Group menu');
      fireEvent.click(menuButton);
      
      const overlay = screen.getByRole('button', { name: 'Group menu' }).parentElement?.querySelector('.fixed');
      if (overlay) {
        fireEvent.click(overlay);
      }
      
      expect(screen.queryByText('Rename')).not.toBeInTheDocument();
    });

    it('should enter edit mode when Rename is clicked', () => {
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const menuButton = screen.getByLabelText('Group menu');
      fireEvent.click(menuButton);
      
      const renameButton = screen.getByText('Rename');
      fireEvent.click(renameButton);
      
      expect(screen.getByDisplayValue('Test Group')).toBeInTheDocument();
    });
  });

  describe('Delete', () => {
    it('should call onDelete with confirmation', () => {
      global.confirm = vi.fn(() => true);
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const menuButton = screen.getByLabelText('Group menu');
      fireEvent.click(menuButton);
      
      const deleteButton = screen.getByText('Delete Group');
      fireEvent.click(deleteButton);
      
      expect(global.confirm).toHaveBeenCalledWith('Delete group "Test Group"? This will ungroup all cards.');
      expect(defaultProps.onDelete).toHaveBeenCalledWith('group-1');
    });

    it('should not delete if confirmation is cancelled', () => {
      global.confirm = vi.fn(() => false);
      renderWithDnd(<GroupCard {...defaultProps} />);
      
      const menuButton = screen.getByLabelText('Group menu');
      fireEvent.click(menuButton);
      
      const deleteButton = screen.getByText('Delete Group');
      fireEvent.click(deleteButton);
      
      expect(defaultProps.onDelete).not.toHaveBeenCalled();
    });
  });

  describe('View Modes', () => {
    it('should apply list view classes', () => {
      const { container } = renderWithDnd(
        <GroupCard {...defaultProps} viewMode="list" />
      );
      
      const groupCard = container.querySelector('.group-card');
      expect(groupCard).toHaveClass('mb-4');
    });

    it('should apply grid view classes', () => {
      const { container } = renderWithDnd(
        <GroupCard {...defaultProps} viewMode="grid" />
      );
      
      const groupCard = container.querySelector('.group-card');
      expect(groupCard).toHaveClass('min-h-[200px]');
    });

    it('should apply queue view classes', () => {
      const { container } = renderWithDnd(
        <GroupCard {...defaultProps} viewMode="queue" />
      );
      
      const groupCard = container.querySelector('.group-card');
      expect(groupCard).toHaveClass('mb-4');
    });
  });
});
