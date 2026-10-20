import { ReactNode } from 'react';

interface PermissionExplainerProps {
  title: string;
  explanation: string;
  icon?: ReactNode;
  children?: ReactNode;
}

export const PermissionExplainer = ({
  title,
  explanation,
  icon,
  children,
}: PermissionExplainerProps) => {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '8px',
      padding: '12px 16px',
      backgroundColor: 'var(--bg)',
      marginBottom: '16px',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
        marginBottom: '8px',
      }}>
        {icon || <span style={{ fontSize: '20px' }}>📍</span>}
        <div>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text)',
          }}>
            {title}
          </h3>
          <p style={{
            margin: '4px 0 0',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
          }}>
            {explanation}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
};