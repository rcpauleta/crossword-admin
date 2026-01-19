import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    // Get all pending harvest jobs
    const { data: pendingJobs, error: jobsError } = await supabase
      .from('HarvestJob')
      .select('id')
      .eq('status_id', 'Pending')

    if (jobsError) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch pending jobs' },
        { status: 500 }
      )
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending harvest jobs',
        jobsProcessed: 0
      })
    }

    console.log(`🌾 Starting auto-harvest for ${pendingJobs.length} job(s)`)

    let completedCount = 0
    const results = []

    // Run each harvest job
    for (const job of pendingJobs) {
      try {
        const harvestResponse = await fetch(
          new URL('/api/harvest', request.url),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: job.id, autoRun: true })
          }
        )

        const result = await harvestResponse.json()
        results.push({ jobId: job.id, ...result })

        if (result.success && result.stats.isComplete) {
          completedCount++
        }
      } catch (err) {
        console.error(`Error processing job ${job.id}:`, err)
        results.push({ jobId: job.id, success: false, error: String(err) })
      }

            // Add small delay between jobs to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    return NextResponse.json({
      success: true,
      jobsProcessed: pendingJobs.length,
      completedCount,
      results
    })

  } catch (error: any) {
    console.error('Auto-harvest error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

