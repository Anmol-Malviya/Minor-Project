"""Top trusted global authority domains and CDNs.

In production cybersecurity architectures (e.g. Cisco Umbrella, Cloudflare, Palo Alto Networks),
verified legitimate domain roots and established SaaS platforms are evaluated with dual-path verification
to prevent false alarms on dynamic session UUIDs or complex paths.
"""

from typing import Set

TOP_TRUSTED_DOMAINS: Set[str] = {
    # Search & Cloud Giants
    "google.com", "google.co.uk", "google.ca", "google.co.in", "google.de", "google.fr", "google.com.br",
    "googleapis.com", "googleusercontent.com", "gstatic.com", "youtube.com", "youtu.be",
    "microsoft.com", "azure.com", "office.com", "live.com", "bing.com", "linkedin.com", "github.com",
    "apple.com", "icloud.com", "cdn-apple.com",
    "amazon.com", "aws.amazon.com", "cloudfront.net", "media-amazon.com",
    "meta.com", "facebook.com", "instagram.com", "whatsapp.com", "fbcdn.net",
    
    # AI & Developer Platforms
    "openai.com", "chatgpt.com", "anthropic.com", "claude.ai", "gitlab.com", "stackoverflow.com",
    "npm.js", "npmjs.com", "pypi.org", "docker.com", "cloudflare.com", "digitalocean.com", "vercel.com",
    
    # Information & Reference
    "wikipedia.org", "wikimedia.org", "mozilla.org", "w3.org", "nih.gov", "cdc.gov", "who.int",
    
    # Major Media, Productivity & Tools
    "netflix.com", "spotify.com", "adobe.com", "salesforce.com", "slack.com", "zoom.us", "dropbox.com",
    "medium.com", "nytimes.com", "bbc.com", "bbc.co.uk", "cnn.com", "reuters.com", "theguardian.com",
    "reddit.com", "twitter.com", "x.com", "twitch.tv", "quora.com", "pinterest.com"
}

def is_trusted_domain(registered_domain: str) -> bool:
    """Checks if registrable domain is a verified global authority domain."""
    if not registered_domain:
        return False
    return registered_domain.lower() in TOP_TRUSTED_DOMAINS
