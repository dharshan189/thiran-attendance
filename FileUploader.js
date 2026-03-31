import { supabase } from './supabase.js';

/**
 * FileUploader component (React version)
 * Note: Your current project is Vanilla JS, but I've created this file as requested.
 * You can import this if you migrate to React.
 */
export function FileUploader() {
  async function handleUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Upload the file to the bucket named 'my-files'
    const { data, error } = await supabase.storage
      .from('my-files')
      .upload(`folder/${file.name}`, file, { upsert: true });

    if (error) {
      alert("Error uploading: " + error.message);
    } else {
      alert("Success! File uploaded to cloud.");
      console.log("File Path:", data.path);
    }
  }

  // This is JSX - it requires a React build step
  // return (
  //   <input type="file" onChange={handleUpload} />
  // );
}

/**
 * Vanilla JS version of the uploader logic
 * You can call this from any file input in your app.
 */
export async function vanillaHandleUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const { data, error } = await supabase.storage
    .from('my-files')
    .upload(`folder/${file.name}`, file, { upsert: true });

  if (error) {
    alert("Error uploading: " + error.message);
  } else {
    alert("Success! File uploaded to cloud.");
    console.log("File Path:", data.path);
  }
}
