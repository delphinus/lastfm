Last.FM for jQuery
==================
[Last.FM][last.fm] から再生履歴を取得して表示します。
ブログのサイドバーに使う用途を想定しています。

使い方
------
詳細は同梱の `sample.html` を見てください。
再生時刻を綺麗に表示するためには [stfmtime.js][strftime.js] が必要です。

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
    username: 'delphinus_iddqd' // アカウント名
    ,apikey: 'xxxxx'            // Last.FM API Key
    ,number: 10                 // 表示するトラック数
    ,artSize: 'large'           // 表示する画像の大きさ
    ,noart: 'noartwork.gif'     // 画像が見つからないときの代替画像
    ,showArtistArt: true        // アルバムアートが見つからないときは
                                // アーティストの画像を表示する
    ,autoUpdate: true           // 自動更新する
    ,updateInterval: '10m'      // 更新間隔
    ,drawDelay: true            // 表示を遅らせる
    ,fadeDuration: 500          // 遅らせる間隔（単位：ミリセカンド）
    ,onComplete: function(){}   // 完了したときに実行する関数
});
```

[last.fm]: http://www.lastfm.jp/home "Home – Last.fm"
[strftime.js]: http://hacks.bluesmoon.info/strftime/ "strftime: strftime for Javascript"
