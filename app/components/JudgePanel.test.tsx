// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { JudgePanel } from './JudgePanel';

describe('JudgePanel', () => {
  it('renders both model output and judge reasoning side-by-side', () => {
    render(
      <JudgePanel
        outputText="The capital of France is Paris."
        judgeVerdict={{ score: 5, reasoning: 'Correct and concise answer.' }}
      />,
    );

    expect(screen.getByText('Model Output')).toBeInTheDocument();
    expect(screen.getByText('The capital of France is Paris.')).toBeInTheDocument();

    expect(screen.getByText('Judge Assessment')).toBeInTheDocument();
    expect(screen.getByText('Correct and concise answer.')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('shows "No text output" placeholder when outputText is undefined', () => {
    render(
      <JudgePanel
        outputText={undefined}
        judgeVerdict={{ score: 3, reasoning: 'Nothing to assess.' }}
      />,
    );
    expect(screen.getByText('No text output')).toBeInTheDocument();
  });

  it('shows "No judge verdict" when judgeVerdict is undefined', () => {
    render(
      <JudgePanel
        outputText="Some output text"
        judgeVerdict={undefined}
      />,
    );
    expect(screen.getByText('No judge verdict')).toBeInTheDocument();
    expect(screen.getByText('Some output text')).toBeInTheDocument();
  });

  it('shows score in the judge panel', () => {
    render(
      <JudgePanel
        outputText="Output"
        judgeVerdict={{ score: 2, reasoning: 'Poor response.' }}
      />,
    );
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Poor response.')).toBeInTheDocument();
  });
});
