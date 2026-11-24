import { logOut } from '@/lib/logout-action'

export default function AccountHeading({ title, logoutLabel }: { title: string; logoutLabel: string }) {
  return <div className="account-heading">
    <h1>{title}</h1>
    <form action={logOut}>
      <button type="submit" className="btn btn-secondary">{logoutLabel}</button>
    </form>
  </div>
}
