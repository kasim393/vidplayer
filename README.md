# vidplayer
ZodTV - Video Player

## Support
  - [X] WebSockets (MediaSource)
  - [ ] IOS + Safari (HLS)
  - [ ] Resolution switching
  - [ ] Custom controls

# Arguments (#)
Pass arguments after the hash (#)
```
https://player.zod.tv/#node=<ip>&streamer=<streamer_name>&password=<optional>&zod58=<optional>

node - The IP of the Zod EDGE node hosting the live stream.
streamer - The name of the streamer broadcasting to the node
password - The password for the broadcast (optional)
zod58 - Zod58 Signed Token to identify you if you want to appear as non-guest (optional)
```

## Description
Use the ZodTV Player as a reference for how to fetch live streams (or static HLS content) from the Zod EDGE.

