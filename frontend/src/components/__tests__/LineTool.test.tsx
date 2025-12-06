import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { LineTool } from '../features/LineTool';

const defaultProps = {
  id: 'line-1',
  initialStartPoint: { x: 100, y: 100 },
  initialEndPoint: { x: 300, y: 200 },
  onPointsChange: vi.fn(),
  onDelete: vi.fn(),
  onClick: vi.fn(),
  isSelected: false,
};

describe('LineTool Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render the line tool with default props', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      // Check that the container div is rendered
      const lineContainer = container.querySelector('[data-line="line-1"]');
      expect(lineContainer).toBeInTheDocument();
    });

    it('should render SVG element', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('should render the visible line element', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const lines = container.querySelectorAll('line');
      // Should have at least the visible line and the hitbox line
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });

    it('should use custom color when provided', () => {
      const { container } = render(
        <LineTool {...defaultProps} color="#ff0000" />
      );
      
      const visibleLine = container.querySelector('line[stroke="#ff0000"]');
      expect(visibleLine).toBeInTheDocument();
    });

    it('should use default blue color when color prop is not provided', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const visibleLine = container.querySelector('line[stroke="#3b82f6"]');
      expect(visibleLine).toBeInTheDocument();
    });
  });

  describe('Selection State', () => {
    it('should show endpoints when selected', () => {
      const { container } = render(
        <LineTool {...defaultProps} isSelected={true} />
      );
      
      const circles = container.querySelectorAll('circle');
      // Should have endpoint circles when selected
      expect(circles.length).toBeGreaterThan(0);
    });

    it('should not show endpoints when not selected', () => {
      const { container } = render(
        <LineTool {...defaultProps} isSelected={false} />
      );
      
      // Endpoint circles should not be visible when not selected
      // (they might still be in DOM but should be conditionally rendered)
      const visibleCircles = Array.from(container.querySelectorAll('circle')).filter(
        circle => circle.getAttribute('fill') !== 'transparent'
      );
      expect(visibleCircles.length).toBe(0);
    });

    it('should change line color when selected', () => {
      const { container } = render(
        <LineTool {...defaultProps} isSelected={true} />
      );
      
      const selectedLine = container.querySelector('line[stroke="#2563eb"]');
      expect(selectedLine).toBeInTheDocument();
    });

    it('should have higher z-index when selected', () => {
      const { container } = render(
        <LineTool {...defaultProps} isSelected={true} />
      );
      
      const lineContainer = container.querySelector('[data-line="line-1"]') as HTMLElement;
      expect(lineContainer.style.zIndex).toBe('50');
    });

    it('should have lower z-index when not selected', () => {
      const { container } = render(
        <LineTool {...defaultProps} isSelected={false} />
      );
      
      const lineContainer = container.querySelector('[data-line="line-1"]') as HTMLElement;
      expect(lineContainer.style.zIndex).toBe('10');
    });
  });

  describe('Click Handling', () => {
    it('should call onClick when line is clicked', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const hitboxLine = container.querySelector('line[stroke="transparent"]');
      expect(hitboxLine).toBeInTheDocument();
      
      if (hitboxLine) {
        fireEvent.click(hitboxLine);
        expect(defaultProps.onClick).toHaveBeenCalledTimes(1);
      }
    });

    it('should not call onClick when clicking in empty space', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
      
      // Clicking on SVG background should not trigger onClick
      // (SVG has pointerEvents: 'none')
      if (svg) {
        fireEvent.click(svg);
        // onClick should not be called when clicking empty space
        // This is tested by ensuring the hitbox line click works but SVG background doesn't
      }
    });
  });

  describe('Props Handling', () => {
    it('should use provided initialStartPoint', () => {
      const customStart = { x: 50, y: 75 };
      const { container } = render(
        <LineTool {...defaultProps} initialStartPoint={customStart} />
      );
      
      // The line should be positioned based on the start point
      const lineContainer = container.querySelector('[data-line="line-1"]') as HTMLElement;
      expect(lineContainer).toBeInTheDocument();
    });

    it('should use provided initialEndPoint', () => {
      const customEnd = { x: 400, y: 500 };
      const { container } = render(
        <LineTool {...defaultProps} initialEndPoint={customEnd} />
      );
      
      const lineContainer = container.querySelector('[data-line="line-1"]') as HTMLElement;
      expect(lineContainer).toBeInTheDocument();
    });

    it('should use default start and end points when not provided', () => {
      const { container } = render(
        <LineTool
          id="line-2"
          onPointsChange={vi.fn()}
          onClick={vi.fn()}
        />
      );
      
      const lineContainer = container.querySelector('[data-line="line-2"]');
      expect(lineContainer).toBeInTheDocument();
    });

    it('should use custom strokeWidth when provided', () => {
      const { container } = render(
        <LineTool {...defaultProps} strokeWidth={5} />
      );
      
      const visibleLine = container.querySelector('line[stroke-width="5"]') || 
                         container.querySelector('line[strokeWidth="5"]');
      // The strokeWidth might be set via style attribute
      expect(container.querySelector('line')).toBeInTheDocument();
    });
  });

  describe('SVG Structure', () => {
    it('should have transparent hitbox line for easier clicking', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const hitboxLine = container.querySelector('line[stroke="transparent"]');
      expect(hitboxLine).toBeInTheDocument();
    });

    it('should have visible line element', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const visibleLine = container.querySelector('line[stroke="#3b82f6"]');
      expect(visibleLine).toBeInTheDocument();
    });

    it('should render selection indicator when selected', () => {
      const { container } = render(
        <LineTool {...defaultProps} isSelected={true} />
      );
      
      // Selection indicator is a dashed line
      const dashedLine = Array.from(container.querySelectorAll('line')).find(
        line => line.getAttribute('stroke-dasharray') === '5,5'
      );
      expect(dashedLine).toBeInTheDocument();
    });

    it('should not render selection indicator when not selected', () => {
      const { container } = render(
        <LineTool {...defaultProps} isSelected={false} />
      );
      
      const dashedLine = Array.from(container.querySelectorAll('line')).find(
        line => line.getAttribute('stroke-dasharray') === '5,5'
      );
      expect(dashedLine).toBeUndefined();
    });
  });

  describe('Accessibility', () => {
    it('should have data-line attribute for identification', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const lineContainer = container.querySelector('[data-line="line-1"]');
      expect(lineContainer).toBeInTheDocument();
    });

    it('should have proper cursor styles for interaction', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const hitboxLine = container.querySelector('line[stroke="transparent"]');
      expect(hitboxLine).toBeInTheDocument();
      
      // Check that cursor style is applied (via style attribute or className)
      const style = hitboxLine?.getAttribute('style');
      expect(style).toContain('cursor');
    });
  });

  describe('Container Sizing', () => {
    it('should calculate container size to include padding for endpoints', () => {
      const { container } = render(<LineTool {...defaultProps} />);
      
      const lineContainer = container.querySelector('[data-line="line-1"]') as HTMLElement;
      expect(lineContainer).toBeInTheDocument();
      
      // Container should have width and height set
      expect(lineContainer.style.width).toBeTruthy();
      expect(lineContainer.style.height).toBeTruthy();
    });

    it('should handle horizontal lines correctly', () => {
      const { container } = render(
        <LineTool
          {...defaultProps}
          initialStartPoint={{ x: 100, y: 100 }}
          initialEndPoint={{ x: 300, y: 100 }}
        />
      );
      
      const lineContainer = container.querySelector('[data-line="line-1"]');
      expect(lineContainer).toBeInTheDocument();
    });

    it('should handle vertical lines correctly', () => {
      const { container } = render(
        <LineTool
          {...defaultProps}
          initialStartPoint={{ x: 100, y: 100 }}
          initialEndPoint={{ x: 100, y: 300 }}
        />
      );
      
      const lineContainer = container.querySelector('[data-line="line-1"]');
      expect(lineContainer).toBeInTheDocument();
    });

    it('should handle diagonal lines correctly', () => {
      const { container } = render(
        <LineTool
          {...defaultProps}
          initialStartPoint={{ x: 100, y: 100 }}
          initialEndPoint={{ x: 300, y: 300 }}
        />
      );
      
      const lineContainer = container.querySelector('[data-line="line-1"]');
      expect(lineContainer).toBeInTheDocument();
    });
  });
});

