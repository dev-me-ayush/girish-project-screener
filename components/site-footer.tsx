import Link from "next/link";
import { Logo, Wordmark } from "@/components/logo";
import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-ink">
      <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 text-paper transition-opacity hover:opacity-80"
            >
              <Logo className="h-7 w-7 text-paper" />
              <Wordmark />
            </Link>

            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              {site.footer.blurb}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {site.footer.columns.map((column) => (
              <div key={column.title}>
                <h3 className="eyebrow text-faint">{column.title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map((link) => (
                    <li key={link}>
                      <span className="text-sm text-muted">
                        {link}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-14 max-w-4xl text-xs leading-relaxed text-faint">
          {site.footer.disclaimer}
        </p>
      </div>
    </footer>
  );
}
