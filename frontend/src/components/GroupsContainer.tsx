import React from "react";
import type { Group, ViewMode } from "../types/group";
import { GroupCard } from "./GroupCard";
import { DraggableCard } from "./DraggableCard";

interface GroupsContainerProps {
  groups: Group[];
  viewMode: ViewMode;
  onToggleExpand: (groupId: string, expanded: boolean) => void;
  onRenameGroup: (groupId: string, newTitle: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onCardDrop: (cardId: string, groupId: string) => void;
  getGroupCards: (groupId: string) => any[];
  renderCard: (card: any) => React.ReactNode;
  ungroupedCards?: any[];
}

/**
 * GroupsContainer Component
 * 
 * Container for all groups with support for different view modes
 */
export function GroupsContainer({
  groups,
  viewMode,
  onToggleExpand,
  onRenameGroup,
  onDeleteGroup,
  onCardDrop,
  getGroupCards,
  renderCard,
  ungroupedCards = [],
}: GroupsContainerProps): React.ReactElement {
  const getContainerClasses = () => {
    switch (viewMode) {
      case "grid":
        return "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-4";
      case "queue":
        return "flex flex-col space-y-4 p-4 max-w-2xl mx-auto";
      case "list":
      default:
        return "flex flex-col space-y-4 p-4";
    }
  };

  return (
    <div className={getContainerClasses()}>
      {/* Render all groups */}
      {groups.map((group) => {
        const cards = getGroupCards(group.id);
        return (
          <GroupCard
            key={group.id}
            group={group}
            viewMode={viewMode}
            onToggleExpand={onToggleExpand}
            onRename={onRenameGroup}
            onDelete={onDeleteGroup}
            onCardDrop={onCardDrop}
            cardCount={cards.length}
          >
            {cards.map((card) => (
              <DraggableCard
                key={card.id}
                cardId={card.id}
                groupId={group.id}
                order={card.order}
              >
                {renderCard(card)}
              </DraggableCard>
            ))}
          </GroupCard>
        );
      })}

      {/* Render ungrouped cards section if any exist */}
      {ungroupedCards.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-700 mb-4 px-2">
            Ungrouped Cards
          </h3>
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                : "flex flex-col space-y-3"
            }
          >
            {ungroupedCards.map((card) => (
              <DraggableCard
                key={card.id}
                cardId={card.id}
                groupId={null}
                order={card.order}
              >
                {renderCard(card)}
              </DraggableCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default GroupsContainer;
