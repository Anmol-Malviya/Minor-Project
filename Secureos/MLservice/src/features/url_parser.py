import re
import ipaddress
from urllib.parse import urlparse, unquote
import tldextract

# Initialize offline tldextract instance
_EXTRACTOR = tldextract.TLDExtract(cache_dir=None, suffix_list_urls=None)

class ParsedURL:
    """Encapsulates safely parsed components of a URL."""
    def __init__(self, raw_url: str):
        self.raw_url = str(raw_url).strip()
        self.cleaned_url = self._preprocess_url(self.raw_url)
        self.scheme = ""
        self.netloc = ""
        self.hostname = ""
        self.port = None
        self.path = ""
        self.query = ""
        self.fragment = ""
        self.domain = ""
        self.subdomain = ""
        self.suffix = ""
        self.registered_domain = ""
        self.is_ip = False
        self.is_ipv6 = False
        self.is_punycode = False
        self.parse_success = False

        self._parse()

    def _preprocess_url(self, url: str) -> str:
        url = url.strip()
        # Handle protocol-relative or scheme-less URL safely
        # In modern web browsing, entering bare domains defaults to HTTPS
        if not re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*://", url):
            url = "https://" + url
        
        # Production normalization for bare root domains (e.g., https://google.com -> https://www.google.com)
        # to ensure consistency with standard dataset crawling conventions
        try:
            m = re.match(r"^([a-zA-Z][a-zA-Z0-9+.-]*://)([^/@:?#]+)(.*)$", url)
            if m:
                scheme_prefix, host_part, rest = m.groups()
                # If host has no subdomain and is not an IP address or localhost
                if not host_part.startswith("www.") and "." in host_part and not any(c.isdigit() for c in host_part.split(".")[0]):
                    url = f"{scheme_prefix}www.{host_part}{rest}"
        except Exception:
            pass

        return url

    def _parse(self) -> None:
        try:
            parsed = urlparse(self.cleaned_url)
            self.scheme = parsed.scheme.lower()
            self.netloc = parsed.netloc
            self.path = parsed.path or ""
            self.query = parsed.query or ""
            self.fragment = parsed.fragment or ""

            # Extract hostname and port
            try:
                self.hostname = parsed.hostname or ""
                self.port = parsed.port
            except ValueError:
                # Malformed port or host
                self.hostname = self.netloc.split(":")[0] if ":" in self.netloc else self.netloc
                self.port = None

            self.hostname = self.hostname.lower()

            # IP detection
            self._check_ip()

            # Punycode check (xn--)
            if "xn--" in self.hostname:
                self.is_punycode = True

            # Domain, subdomain, suffix extraction
            ext = _EXTRACTOR(self.hostname)
            self.subdomain = ext.subdomain
            self.domain = ext.domain
            self.suffix = ext.suffix
            self.registered_domain = f"{ext.domain}.{ext.suffix}".lower() if ext.domain and ext.suffix else self.hostname.lower()

            self.parse_success = True
        except Exception:
            self.parse_success = False

    def _check_ip(self) -> None:
        if not self.hostname:
            return
        # Test IPv4
        try:
            ipaddress.IPv4Address(self.hostname)
            self.is_ip = True
            return
        except ValueError:
            pass

        # Test IPv6 (sometimes in bracket format [::1])
        host_clean = self.hostname.strip("[]")
        try:
            ipaddress.IPv6Address(host_clean)
            self.is_ip = True
            self.is_ipv6 = True
            return
        except ValueError:
            pass
