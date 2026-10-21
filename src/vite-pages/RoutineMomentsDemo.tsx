// src/pages/RoutineMomentsDemo.tsx
import React from 'react';
import { RoutineMomentLogger } from '../components/routine-moments/RoutineMomentLogger';
import { getPersonId } from '../api/client';

export const RoutineMomentsDemo: React.FC = () => {
  const personId = getPersonId();

  return (
    <div className="routine-moments-demo">
      <header>
        <h1>Routine Moments Demo</h1>
        <p>
          This demo demonstrates the Routine Moments feature, which allows logging
          observations of routines and detecting changes over time.
        </p>
      </header>
      <main>
        <RoutineMomentLogger personId={personId} />
      </main>
    </div>
  );
};

export default RoutineMomentsDemo;