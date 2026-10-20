import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { AttentionItemsResponse } from '@/src/lib/care-attention/types'

interface WhatMattersProps {
  careRecipientId: string
  caregiverId: string
}

export default function WhatMatters({ careRecipientId, caregiverId }: WhatMattersProps) {
  const [data, setData] = useState<AttentionItemsResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch what matters data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        const response = await fetch(`/api/care-attention?caregiver_id=${caregiverId}&care_recipient_id=${careRecipientId}`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const result = await response.json()
        setData(result)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch care attention data:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [careRecipientId, caregiverId])

  if (loading) {
    return <div className="p-6">Loading what matters...</div>
  }

  if (error) {
    return <div className="p-6 text-red-500">Error: {error}</div>
  }

  if (!data) {
    return <div className="p-6">No data available</div>
  }

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-bold">What Matters Now</h1>
      
      {/* Needs Attention */}
      <section>
        <h2 className="text-xl font-semibold text-red-600">Needs Attention</h2>
        {data.needsAttention.length === 0 ? (
          <p className="text-gray-500">No items requiring immediate attention</p>
        ) : (
          <div className="space-y-4">
            {data.needsAttention.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="needs-attention"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Awaiting Confirmation */}
      <section>
        <h2 className="text-xl font-semibold text-orange-600">Awaiting Confirmation</h2>
        {data.awaitingConfirmation.length === 0 ? (
          <p className="text-gray-500">No items awaiting confirmation</p>
        ) : (
          <div className="space-y-4">
            {data.awaitingConfirmation.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="awaiting-confirmation"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Professional Follow-Up */}
      <section>
        <h2 className="text-xl font-semibold text-blue-600">Professional Follow-Up</h2>
        {data.professionalFollowUp.length === 0 ? (
          <p className="text-gray-500">No professional follow-ups needed</p>
        ) : (
          <div className="space-y-4">
            {data.professionalFollowUp.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="professional-followup"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Upcoming */}
      <section>
        <h2 className="text-xl font-semibold text-green-600">Upcoming</h2>
        {data.upcoming.length === 0 ? (
          <p className="text-gray-500">No upcoming items</p>
        ) : (
          <div className="space-y-4">
            {data.upcoming.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="upcoming"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Important Context */}
      <section>
        <h2 className="text-xl font-semibold text-purple-600">Important Context</h2>
        {data.importantContext.length === 0 ? (
          <p className="text-gray-500">No important context items</p>
        ) : (
          <div className="space-y-4">
            {data.importantContext.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="important-context"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Can Wait / Low Priority */}
      <section>
        <h2 className="text-xl font-semibold text-gray-600">Can Wait / Low Priority</h2>
        {data.canWait.length === 0 ? (
          <p className="text-gray-500">No items that can wait</p>
        ) : (
          <div className="space-y-4">
            {data.canWait.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="can-wait"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Unknowns */}
      <section>
        <h2 className="text-xl font-semibold text-gray-600">Unknowns</h2>
        {data.unknowns.length === 0 ? (
          <p className="text-gray-500">No unknowns</p>
        ) : (
          <div className="space-y-4">
            {data.unknowns.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="unknowns"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Conflicts */}
      <section>
        <h2 className="text-xl font-semibold text-gray-600">Conflicts</h2>
        {data.conflicts.length === 0 ? (
          <p className="text-gray-500">No conflicts</p>
        ) : (
          <div className="space-y-4">
            {data.conflicts.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="conflicts"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Changes */}
      <section>
        <h2 className="text-xl font-semibold text-gray-600">Recent Changes</h2>
        {data.recentChanges.length === 0 ? (
          <p className="text-gray-500">No recent changes</p>
        ) : (
          <div className="space-y-4">
            {data.recentChanges.map((item, index) => (
              <AttentionItemCard 
                key={item.id} 
                item={item} 
                type="recent-changes"
                index={index + 1}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

// Helper component to render individual attention items
function AttentionItemCard({ 
  item, 
  type, 
  index 
}: { 
  item: any; 
  type: string; 
  index: number 
}) {
  // Determine card color based on type
  const getColorClass = (type: string) => {
    switch (type) {
      case 'needs-attention': return 'border-red-500 bg-red-50'
      case 'awaiting-confirmation': return 'border-orange-500 bg-orange-50'
      case 'professional-followup': return 'border-blue-500 bg-blue-50'
      case 'upcoming': return 'border-green-500 bg-green-50'
      case 'important-context': return 'border-purple-500 bg-purple-50'
      case 'can-wait': return 'border-gray-500 bg-gray-50'
      case 'unknowns': return 'border-gray-500 bg-gray-50'
      case 'conflicts': return 'border-gray-500 bg-gray-50'
      case 'recent-changes': return 'border-gray-500 bg-gray-50'
      default: return 'border-gray-300 bg-white'
    }
  }

  // Format date for display
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Not specified'
    try {
      return new Date(dateString).toLocaleDateString()
    } catch {
      return dateString
    }
  }

  return (
    <div className={`p-4 border-l-4 ${getColorClass(type)} rounded-lg shadow-sm hover:shadow-md transition-shadow`}
         onClick={() => handleItemClick(item)}>
      <div className="flex justify-between items-start mb-2">
        <div className="font-medium">{index}. {item.attention_reason}</div>
        <div className="text-xs text-gray-500">
          {item.attention_state !== undefined ? 
            `<${item.attention_state.replace(/_/g, ' ')}>` : ''}
        </div>
      </div>
      
      {/* Evidence section */}
      {item.evidence && item.evidence.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          <strong>Evidence:</strong> {item.evidence.length} item(s)
        </div>
      )}
      
      {/* Uncertainty section */}
      {item.uncertainty && item.uncertainty.length > 0 && (
        <div className="mt-2 text-sm text-gray-600">
          <strong>Uncertainty:</strong> {item.uncertainty.join(', ')}
        </div>
      )}
      
      {/* Current status */}
      {item.current_status && (
        <div className="mt-2 text-sm text-gray-600">
          <strong>Status:</strong> {item.current_status}
        </div>
      )}
      
      {/* Explanation (why it matters) - per specification requirement */}
      <div className="mt-2 text-sm text-gray-700 italic">
        <strong>Why it matters:</strong> {item.attention_reason}
      </div>
      
      {/* Possible next action - per specification requirement */}
      {item.related_objects.appointment && (
        <div className="mt-2 text-sm text-green-600">
          <strong>Next action:</strong> Prepare for upcoming appointment
        </div>
      )}
      
      {!item.related_objects.appointment && item.uncertainty.length > 0 && (
        <div className="mt-2 text-sm text-blue-600">
          <strong>Next action:</strong> Seek clarification on: {item.uncertainty[0]}
        </div>
      )}
      
      {/* User action buttons */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
        <button 
          onClick={() => handleMarkImportant(item)}
          className="px-3 py-1 text-sm {item.user_importance === 'IMPORTANT' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'} rounded"
        >
          Mark Important
        </button>
        <button 
          onClick={() => handleMarkInformational(item)}
          className="px-3 py-1 text-sm {item.user_importance === 'INFORMATIONAL' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'} rounded"
        >
          Mark Informational
        </button>
        <button 
          onClick={() => handleMarkLowPriority(item)}
          className="px-3 py-1 text-sm {item.user_importance === 'LOW_PRIORITY' ? 'bg-blue-100 text-blue-800' : 'bg-gray-200 text-gray-700'} rounded"
        >
          Low Priority
        </button>
        {item.attention_state !== 'RESOLVED' && (
          <button 
            onClick={() => handleMarkResolved(item)}
            className="px-3 py-1 text-sm {item.attention_state === 'RESOLVED' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'} rounded"
          >
            Mark Resolved
          </button>
        )}
        {item.attention_state === 'NEEDS_ATTENTION' && (
          <button 
            onClick={() => handleMarkAwaitingConfirmation(item)}
            className="px-3 py-1 text-sm {item.attention_state === 'AWAITING_CONFIRMATION' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-200 text-gray-700'} rounded"
          >
            Awaiting Confirmation
          </button>
        )}
      </div>
    </div>
  )

  // Handler functions (would connect to API in real implementation)
  async function handleMarkImportant(item: any) {
    // Would call API to update user_importance to 'IMPORTANT'
    console.log('Marking item as important:', item.id)
  }

  async function handleMarkInformational(item: any) {
    // Would call API to update user_importance to 'INFORMATIONAL'
    console.log('Marking item as informational:', item.id)
  }

  async function handleMarkLowPriority(item: any) {
    // Would call API to update user_importance to 'LOW_PRIORITY'
    console.log('Marking item as low priority:', item.id)
  }

  async function handleMarkResolved(item: any) {
    // Would call API to update attention_state to 'RESOLVED'
    console.log('Marking item as resolved:', item.id)
  }

  async function handleMarkAwaitingConfirmation(item: any) {
    // Would call API to update attention_state to 'AWAITING_CONFIRMATION'
    console.log('Marking item as awaiting confirmation:', item.id)
  }

  async function handleItemClick(item: any) {
    // Would open detailed view of the item
    console.log('Item clicked:', item.id)
  }
}