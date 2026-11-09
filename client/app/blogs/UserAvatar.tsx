export function UserAvatar({ name, avatarURL, className = "" }: { name: string; avatarURL?: string; className?: string }) {
  const avatar = avatarURL?.startsWith("data:image/jpeg;base64,") ? avatarURL : "/avatars/default.svg";
  return <span role="img" aria-label={`${name}'s avatar`} className={`user-avatar ${className}`} style={{ backgroundImage: `url("${avatar}")` }} />;
}
