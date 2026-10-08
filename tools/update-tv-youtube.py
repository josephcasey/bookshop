"""Find the newest video for each of Mabel's YouTube programmes (a channel + a title pattern) and write them to
content/tv/youtube.json. Run by .github/workflows/tv-youtube.yml (the browser can't read YouTube itself: no CORS).

Each programme in the file: { key, name, genre, color, channelId, handle, match (regex on the title), query (for the
channel's search page), insist (Mabel watches a new one first) }. The newest match is looked for in the channel's feed
(its latest 15 uploads), and if none is there, in the channel's own search results (ordered by their "2d ago" ages).
  python3 tools/update-tv-youtube.py"""
import json, os, re, urllib.parse, urllib.request
from html import unescape

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'content', 'tv', 'youtube.json')
UA = {'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36', 'Accept-Language': 'en'}
DEFAULT = [
    {'key': 'lawrence', 'name': 'MS NOW: The Last Word', 'genre': 'News, from YouTube', 'color': '#d02030',
     'channelId': 'UCaXkIU1QidjPwiAYu6GcHjg', 'handle': '@msnow', 'match': r'^Lawrence:', 'query': 'Lawrence', 'insist': True},
    {'key': 'nicolle', 'name': 'MS NOW: Deadline: White House', 'genre': 'News, from YouTube', 'color': '#3a5ad0',
     'channelId': 'UCaXkIU1QidjPwiAYu6GcHjg', 'handle': '@msnow', 'match': r'Nicolle', 'query': 'Nicolle', 'insist': True},
    {'key': 'eu5', 'name': 'Generalist Gaming: EU5', 'genre': 'Grand strategy, from YouTube', 'color': '#c8a040',
     'channelId': 'UC8ep1P0GsTYGkiXaSI59QMw', 'handle': '@generalistgaming', 'match': r'\bEU5\b|Europa Universalis', 'query': 'EU5', 'insist': False},
]

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25).read().decode('utf-8', 'replace')

def from_feed(p):
    xml = get('https://www.youtube.com/feeds/videos.xml?channel_id=' + p['channelId'])
    for vid, title, pub in re.findall(r'<entry>.*?<yt:videoId>([^<]+)</yt:videoId>.*?<title>([^<]+)</title>.*?<published>([^<]+)</published>', xml, re.S):
        title = unescape(title)
        if re.search(p['match'], title, re.I):
            return vid, title, pub
    return None

AGE = {'second': 1 / 3600, 'minute': 1 / 60, 'hour': 1, 'day': 24, 'week': 168, 'month': 720, 'year': 8760}
def age_hours(text):
    m = re.search(r'(\d+)\s*(second|minute|hour|day|week|month|year)', text or '')
    if m:
        return int(m.group(1)) * AGE[m.group(2)]
    m = re.search(r'(\d+)\s*(s|m|h|d|w|mo|y)\b', text or '')  # the short forms: "2d ago", "5mo ago"
    if m:
        return int(m.group(1)) * {'s': 1 / 3600, 'm': 1 / 60, 'h': 1, 'd': 24, 'w': 168, 'mo': 720, 'y': 8760}[m.group(2)]
    return 1e9

def from_search(p):
    html = get('https://www.youtube.com/%s/search?query=%s' % (p['handle'], urllib.parse.quote(p['query'])))
    m = re.search(r'var ytInitialData = (\{.*?\});</script>', html)
    if not m:
        return None
    found = []
    def walk(o):
        if isinstance(o, dict):
            v = o.get('videoRenderer')
            if v:
                title = ''.join(r.get('text', '') for r in v.get('title', {}).get('runs', []))
                when = (v.get('publishedTimeText') or {}).get('simpleText', '')
                if re.search(p['match'], title, re.I) and v.get('videoId'):
                    found.append((age_hours(when), v['videoId'], title, when))
            for x in o.values():
                walk(x)
        elif isinstance(o, list):
            for x in o:
                walk(x)
    walk(json.loads(m.group(1)))
    if not found:
        return None
    found.sort()
    _, vid, title, when = found[0]
    return vid, title, when

def main():
    try:
        cur = json.load(open(OUT))
    except Exception:
        cur = {}
    old = {p['key']: p for p in cur.get('shows', [])}
    shows = []
    for d in DEFAULT:
        p = dict(d, **{k: v for k, v in old.get(d['key'], {}).items() if k in d})  # the file's settings win
        hit = None
        try:
            hit = from_feed(p) or from_search(p)
        except Exception as e:
            print(p['key'], 'lookup failed:', e)
        prev = old.get(p['key'], {})
        if hit:
            p['id'], p['title'], p['published'] = hit
        elif prev.get('id'):
            p['id'], p['title'], p['published'] = prev['id'], prev.get('title', ''), prev.get('published', '')
        print(p['key'], p.get('id'), (p.get('title') or '')[:80])
        shows.append(p)
    new = {'shows': shows}
    if new == cur:
        print('unchanged')
        return
    with open(OUT, 'w') as f:
        json.dump(new, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('updated')

if __name__ == '__main__':
    main()
