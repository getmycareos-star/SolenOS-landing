import type { NextRequest } from "next/server";

import { NextResponse } from "next/server";



import {

  CONTINUITY_DECAY_IDENTITY,

  processContinuityDecay,

} from "@/lib/continuity-decay-engine";

import { getCareContextRoot } from "@/lib/situation-entry";

import { queryPriorityEvents } from "@/lib/care-event-priority";



const DEFAULT_CAREGIVER_ID = "default_caregiver";



/** GET /api/situation/decay — continuity confidence and refresh planning */

export async function GET(req: NextRequest) {

  const caregiverId = req.nextUrl.searchParams.get("caregiver_id") ?? DEFAULT_CAREGIVER_ID;

  const asOf = req.nextUrl.searchParams.get("as_of") ?? new Date().toISOString();

  const context = getCareContextRoot(caregiverId);



  if (!context || context.events.length === 0) {

    return NextResponse.json({

      identity: CONTINUITY_DECAY_IDENTITY,

      triggered: false,

    });

  }



  const priorityQuery = queryPriorityEvents(context.events);



  const layer = processContinuityDecay({

    caregiver_id: caregiverId,

    all_events: context.events,

    events_created: [],

    what_needs_clarification: [],

    what_is_uncertain: [],

    attention_event_ids: priorityQuery.attention_events.map((e) => e.id),

    what_changed: [],

    as_of: asOf,

    trigger: "background",

  });



  return NextResponse.json({

    identity: CONTINUITY_DECAY_IDENTITY,

    continuity_decay_layer: layer,

  });

}


