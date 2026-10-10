// Gives AI generation (which can take 20–40s) enough time on Vercel before
// the function is cut off. Hobby plan allows up to 60s.
export const maxDuration = 60

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
