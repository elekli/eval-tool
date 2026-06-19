// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SuiteForm } from './SuiteForm';

describe('SuiteForm', () => {
  it('does not show ToolSchemaEditor when type is behavior', () => {
    render(<SuiteForm onSaved={vi.fn()} />);
    expect(screen.queryByText('Virtual Tool Definitions')).toBeNull();
  });

  it('shows ToolSchemaEditor when type switches to tool_use', () => {
    render(<SuiteForm onSaved={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: /eval type/i });
    fireEvent.change(select, { target: { value: 'tool_use' } });
    expect(screen.getByText('Virtual Tool Definitions')).toBeInTheDocument();
  });

  it('hides ToolSchemaEditor when type switches back to behavior', () => {
    render(<SuiteForm onSaved={vi.fn()} />);
    const select = screen.getByRole('combobox', { name: /eval type/i });
    fireEvent.change(select, { target: { value: 'tool_use' } });
    expect(screen.getByText('Virtual Tool Definitions')).toBeInTheDocument();
    fireEvent.change(select, { target: { value: 'behavior' } });
    expect(screen.queryByText('Virtual Tool Definitions')).toBeNull();
  });

  it('shows judge fields when judge is enabled', () => {
    render(<SuiteForm onSaved={vi.fn()} />);
    const checkbox = screen.getByRole('checkbox', { name: /enable judge scoring/i });
    expect(screen.queryByPlaceholderText(/Describe what a good response/i)).toBeNull();
    fireEvent.click(checkbox);
    expect(screen.getByPlaceholderText(/Describe what a good response/i)).toBeInTheDocument();
  });

  it('renders with initial suite data for editing', () => {
    const suite = {
      id: 'suite-1',
      ownerId: 'local',
      name: 'My Test Suite',
      type: 'tool_use' as const,
      target: {
        model: 'openai/gpt-4o',
        systemPrompt: 'Test system prompt',
        userPromptTemplate: '{{query}}',
        temperature: 0.5,
        tools: [],
      },
      judge: null,
      runConfig: { nRepeats: 5 },
      createdAt: Date.now(),
    };
    render(<SuiteForm initial={suite} onSaved={vi.fn()} />);
    expect(screen.getByDisplayValue('My Test Suite')).toBeInTheDocument();
    expect(screen.getByDisplayValue('openai/gpt-4o')).toBeInTheDocument();
    // tool_use → ToolSchemaEditor should be visible
    expect(screen.getByText('Virtual Tool Definitions')).toBeInTheDocument();
  });
});
