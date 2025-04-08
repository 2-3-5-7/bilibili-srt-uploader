# Bilibili SRT Subtitle Uploader

## 简介

这是一个用于上传 SRT 字幕到 Bilibili 的命令行工具。该工具可以配合命令行投稿程序 [biliup-rs](https://github.com/biliup/biliup-rs) 使用，获取 `bvid` 后提交字幕

## 使用方法

### 依赖

在使用此工具之前，请确保已安装以下依赖：

- Node.js
- npm

### 安装

1. 克隆此仓库：
   ```bash
   git clone https://github.com/2-3-5-7/bilibili-srt-uploader
   cd bilibili-srt-uploader
   ```

2. 安装依赖：
   ```bash
   npm install
   ```

### 使用

运行以下命令上传字幕：

```bash
node upload_srt.js <bvid> <subtitlePath> [lan]
```

- `<bvid>`：视频的 bvid，可通过 [biliup-rs](https://github.com/biliup/biliup-rs) 获取。
- `<subtitlePath>`：字幕文件的路径。
- `[lan]`：可选参数，字幕语言，默认值为 `zh-Hans`（中文简体）。可选值见 [subtitle_lan.json](https://i0.hdslb.com/bfs/subtitle/subtitle_lan.json)。

### 示例

```bash
node upload_srt.js BV1xx411c7mD ./subtitle.srt
```

或指定语言：

```bash
node upload_srt.js BV1xx411c7mD ./subtitle.srt zh-Hant  # 中文繁体
```

```bash
node upload_srt.js BV1xx411c7mD ./subtitle.srt en  # 英语
```

## 注意事项

- 确保 `cookies.json` 文件存在于当前目录，并包含有效的登录信息。可以使用浏览器插件 [Cookie-Editor](https://cookie-editor.cgagnier.ca/) 导出 JSON 格式 cookies。
- 人工通过网页端投稿的视频，即使审核中也可以成功提交字幕，但是用工具 [biliup-rs](https://github.com/biliup/biliup-rs) 投稿的视频则要等审核通过才能提交字幕，**审核中提交的字幕不会生效**，这可能是用的 API 不同或者是 API 某些字段的值不同

## 许可证

MIT License 