// Shared in-memory storage for Vercel serverless endpoints.
// NOTE: This is not durable across cold starts and should not be used for production state.
// For persistent storage, replace this with a database or external key-value store.

export const sharedData = {
  attendanceRecords: [],
  activeMeetLink: '',
  conductedCount: 0,
};
