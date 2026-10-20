"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandLoading } from "@/components/brand";
import { Button } from "@/components/ui/Button";
import { ErrorBoundary } from "@/components/error-boundary";
import { WhatMatters } from "@/components/care-attention";

interface CareAttentionPageProps {
  params: {
    careRecipientId: string
  }
  searchParams: {
    caregiver_id: string
  }
}

export const generateMetadata = async () => {
  return {
    title: "What Matters - SolenOS",
    description: "See what deserves your attention in the care situation",
  };
};

function CareAttentionPageInner({ 
  params, 
  searchParams 
}: CareAttentionPageProps) {
  const { careRecipientId } = params;
  const { caregiver_id } = searchParams;
  
  // Default caregiver ID if not provided (in real app, this would come from auth)
  const caregiverId = caregiver_id || "default-caregiver-id";

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">What Matters</h1>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline"
            onClick={() => {
              // In real implementation, this would refresh the data
              window.location.reload();
            }}
          >
            Refresh
          </Button>
        </div>
      </div>
      
      <Suspense fallback={<BrandLoading message="Loading what matters…" />}>
        <ErrorBoundary name="WhatMatters" fallback={
          <div className="p-6 bg-red-50 border-l-4 border-red-200">
            <p className="text-red-600">The What Matters feature encountered an error. Please try refreshing.</p>
            <Button variant="primary" onClick={() => window.location.reload()}>
              Refresh
            </Button>
          </div>
        }>
          <WhatMatters 
            careRecipientId={careRecipientId} 
            caregiverId={caregiverId} 
          />
        </ErrorBoundary>
      </Suspense>
      
      {/* Help section */}
      <div className="mt-10 p-4 bg-gray-50 rounded-lg">
        <h2 className="font-semibold mb-2">How to use this view</h2>
        <p className="text-sm text-gray-600">
          This view helps you understand what deserves your attention in the care situation. 
          Items are grouped by urgency and type. You can mark items as important, informational, 
          or low priority based on your judgment.
        </p>
        <div className="mt-4 text-sm text-gray-500 space-y-1">
          <p>• <strong>Needs Attention</strong>: Items requiring your immediate focus</p>
          <p>• <strong>Awaiting Confirmation</strong>: Items needing verification or clarification</p>
          <p>• <strong>Professional Follow-Up</strong>: Items requiring professional involvement</p>
          <p>• <strong>Upcoming</strong>: Appointments or events requiring preparation</p>
          <p>• <strong>Important Context</strong>: Information you've marked as important but doesn't require action</p>
          <p>• <strong>Can Wait / Low Priority</strong>: Information that can be deferred</p>
          <p>• <strong>Unknowns</strong>: Information gaps that need to be filled</p>
          <p>• <strong>Conflicts</strong>: Contradictory information that needs resolution</p>
          <p>• <strong>Recent Changes</strong>: Meaningful changes in the care situation</p>
        </div>
      </div>
    </div>
  );
}

export default function CareAttentionPage({ 
  params, 
  searchParams 
}: CareAttentionPageProps) {
  // Handle missing parameters gracefully
  if (!params?.careRecipientId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-red-600">Missing Care Recipient ID</h1>
        <p className="mt-4">Please provide a care recipient ID to view what matters.</p>
        <div className="mt-6">
          <Button 
            variant="secondary"
            onClick={() => {
              // Navigate to workspace or home
              window.location.href = '/';
            }}
          >
            Go to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<BrandLoading message="Loading care context…" />}>
      <CareAttentionPageInner 
        params={params} 
        searchParams={searchParams} 
      />
    </Suspense>
  );
}