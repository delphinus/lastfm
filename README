Last.FM for jQuery
==================
[Last.FM][lastfm] から再生履歴を取得して表示します。
ブログのサイドバーに使う用途を想定しています。

使い方
------
詳細は同梱の `sample.html` を見てください。

### HTML ###

```html
<dl>
  <dt>Last.FM Recently Played</dt>
  <dd>
    <ul id="lastfm">
      <li>
        <div class="lfm_art"><a href="#"></a></div> /* Album Art */
        <div class="lfm_song"></div> /* Song Title */
        <div class="lfm_artist"></div> /* Artist */
        <div class="lfm_datetime"></div> /* Timestamp */
      </li>
    </ul>
  </dd>
</dl>
```

### Javascript ###

```javascript
$('#lastfm').lastFM({
    username: 'delphinus_iddqd' // account name to display
    ,apikey: 'xxxxx'            // your apikey
    ,number: 10                 // tracks
    ,artSize: 'large'           // size of picture
    ,noart: 'noartwork.gif'     // for tracks that have no pictures
    ,showArtistArt: true
        // テスト
        // if true, album arts are displayed instead of artist arts.
    ,autoUpdate: true
        // if true, list is being updated in some interval.
    ,updateInterval: '10m'
        // if autoUpdate is true, this interval is used.
        // you can use prefix: h => hours, m => minutes, s => seconds
    ,drawDelay: true
        // if true, tracks will appear with fade-in effect.
    ,fadeDuration: 500
        // duration for fade-in. this must be specified in milliseconds.
    ,onComplete: function(){}
        // callback to be called when query has finished.
});
```

[lastfm]: http://www.lastfm.jp/home "Home – Last.fm"
