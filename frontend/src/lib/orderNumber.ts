import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Calculates the exact sequential Task ID (e.g., RU-0098)
 * matching the order grouping displayed in the Admin Dashboard.
 */
export async function computeTaskDisplayId(
  supabase: SupabaseClient,
  targetJobId: string
): Promise<string> {
  try {
    const { data: rawJobs, error } = await supabase
      .from('PrintJob')
      .select('id, createdAt, userName')
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .order('createdAt', { ascending: false })
      .limit(1000);

    if (error || !rawJobs || rawJobs.length === 0) {
      return `RU-${targetJobId.slice(0, 4).toUpperCase()}`;
    }

    // Group files belonging to the same order (same user within 60s)
    const processedJobs: any[][] = [];
    for (const job of rawJobs) {
      const existingGroupIndex = processedJobs.findIndex((group) => {
        const firstInGroup = group[0];
        const lastInGroup = group[group.length - 1];
        if (firstInGroup.userName !== job.userName) return false;

        const timeDiffFirst = Math.abs(
          new Date(firstInGroup.createdAt).getTime() - new Date(job.createdAt).getTime()
        );
        const timeDiffLast = Math.abs(
          new Date(lastInGroup.createdAt).getTime() - new Date(job.createdAt).getTime()
        );

        return timeDiffFirst <= 60000 || timeDiffLast <= 60000;
      });

      if (existingGroupIndex !== -1) {
        processedJobs[existingGroupIndex].push(job);
      } else {
        processedJobs.push([job]);
      }
    }

    const groupIdx = processedJobs.findIndex((group) =>
      group.some((item) => item.id === targetJobId)
    );

    if (groupIdx !== -1) {
      const serial = processedJobs.length - groupIdx;
      return `RU-${String(serial).padStart(4, "0")}`;
    }

    return `RU-${String(processedJobs.length || 1).padStart(4, "0")}`;
  } catch (err) {
    console.error('Error computing task display ID:', err);
    return `RU-${targetJobId.slice(0, 4).toUpperCase()}`;
  }
}
