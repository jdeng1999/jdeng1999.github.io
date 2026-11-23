import type { Props } from "astro";
import IconMail from "@/assets/icons/IconMail.svg";
import IconGithubSolid from "@/assets/icons/IconGithubSolid.svg";
import IconXSolid from "@/assets/icons/IconXSolid.svg";
import IconLinkedinSolid from "@/assets/icons/IconLinkedinSolid.svg";
import IconGmail from "@/assets/icons/IconGmail.svg";
import IconBrandX from "@/assets/icons/IconBrandX.svg";
import IconWhatsapp from "@/assets/icons/IconWhatsapp.svg";
import IconFacebook from "@/assets/icons/IconFacebook.svg";
import IconTelegram from "@/assets/icons/IconTelegram.svg";
import IconPinterest from "@/assets/icons/IconPinterest.svg";
import {
  PUBLIC_SOCIAL_GITHUB,
  PUBLIC_SOCIAL_X,
  PUBLIC_SOCIAL_LINKEDIN,
  PUBLIC_SOCIAL_EMAIL,
} from "astro:env/client";
import { SITE } from "@/config";

interface Social {
  name: string;
  href: string;
  linkTitle: string;
  icon: (_props: Props) => Element;
}

// ── Profile socials ────────────────────────────────────────────────────────
// URLs can be overridden with PUBLIC_SOCIAL_* environment variables (see
// .env.example). The deployed build has no .env file, so public defaults keep
// the site's profile links visible; forks should replace them or set the env
// variables. An empty value hides that link.
const envOrFallback = (value: string | undefined, fallback: string) =>
  value === "" ? "" : (value ?? fallback);

const socialGithub = envOrFallback(
  PUBLIC_SOCIAL_GITHUB,
  "https://github.com/jdeng1999"
);
const socialX = envOrFallback(PUBLIC_SOCIAL_X, "https://x.com/JiaDeng12947");
const socialLinkedin = envOrFallback(
  PUBLIC_SOCIAL_LINKEDIN,
  "http://www.linkedin.com/in/jdeng1999"
);
const socialEmail = envOrFallback(PUBLIC_SOCIAL_EMAIL, "dengjiaaa@gmail.com");

export const SOCIALS: Social[] = (
  [
    {
      name: "GitHub",
      href: socialGithub,
      linkTitle: `${SITE.title} on GitHub`,
      icon: IconGithubSolid,
    },
    {
      name: "X",
      href: socialX,
      linkTitle: `${SITE.title} on X`,
      icon: IconXSolid,
    },
    {
      name: "LinkedIn",
      href: socialLinkedin,
      linkTitle: `${SITE.title} on LinkedIn`,
      icon: IconLinkedinSolid,
    },
    {
      name: "Mail",
      href: socialEmail
        ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(
            socialEmail
          )}`
        : "",
      linkTitle: `Send an email to ${SITE.title}`,
      icon: IconGmail,
    },
  ] satisfies Social[]
).filter(s => s.href !== "");

// ── Share links ────────────────────────────────────────────────────────────
// These use standard platform share URLs — no personal data involved.
// The "Mail" entry opens the visitor's own email client, not the author's.
export const SHARE_LINKS: Social[] = [
  {
    name: "WhatsApp",
    href: "https://wa.me/?text=",
    linkTitle: "Share this post via WhatsApp",
    icon: IconWhatsapp,
  },
  {
    name: "Facebook",
    href: "https://www.facebook.com/sharer.php?u=",
    linkTitle: "Share this post on Facebook",
    icon: IconFacebook,
  },
  {
    name: "X",
    href: "https://x.com/intent/post?url=",
    linkTitle: "Share this post on X",
    icon: IconBrandX,
  },
  {
    name: "Telegram",
    href: "https://t.me/share/url?url=",
    linkTitle: "Share this post via Telegram",
    icon: IconTelegram,
  },
  {
    name: "Pinterest",
    href: "https://pinterest.com/pin/create/button/?url=",
    linkTitle: "Share this post on Pinterest",
    icon: IconPinterest,
  },
  {
    name: "Mail",
    href: "mailto:?subject=See%20this%20post&body=",
    linkTitle: "Share this post via email",
    icon: IconMail,
  },
] as const;
