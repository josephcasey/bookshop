"""Find the newest video on a YouTube channel whose title matches a pattern, and write it to content/tv/youtube.json
for Mabel's telly. Run by .github/workflows/tv-youtube.yml (the browser can't read YouTube's feeds itself: no CORS).
  python3 tools/update-tv-youtube.py        -> prints whether it changed (exit 0 either way)"""
import json, os, re, sys, urllib.request
from html import unescape

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'content', 'tv', 'youtube.json')
CONF = {
    'channel': 'MS NOW',
    'channelId': 'UCaXkIU1QidjPwiAYu6GcHjg',  # youtube.com/@msnow
    'match': r'^Lawrence:',  # The Last Word's segments ("Lawrence: ...")
}

def main():
    try:
        cur = json.load(open(OUT))
    except Exception:
        cur = {}
    conf = {k: cur.get(k, v) for k, v in CONF.items()}
    url = 'https://www.youtube.com/feeds/videos.xml?channel_id=' + conf['channelId']
    xml = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20).read().decode()
    entries = re.findall(r'<entry>.*?<yt:videoId>([^<]+)</yt:videoId>.*?<title>([^<]+)</title>.*?<published>([^<]+)</published>', xml, re.S)
    pick = next(((vid, unescape(title), pub) for vid, title, pub in entries if re.search(conf['match'], unescape(title))), None)
    if not pick:
        print('no matching video in the feed; leaving', cur.get('id'))
        return
    vid, title, pub = pick
    new = dict(conf, id=vid, title=title, published=pub)
    if new == cur:
        print('unchanged', vid)
        return
    with open(OUT, 'w') as f:
        json.dump(new, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('updated', vid, title)

if __name__ == '__main__':
    main()
