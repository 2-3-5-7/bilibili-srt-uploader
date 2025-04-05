import fs from 'fs';
import axios from 'axios';
import FormData from 'form-data';

// 创建一个函数来检查稿件是否存在并获取 cid 和 aid，支持重试机制
async function checkVideoExistsAndGetInfo(bvid, cookiesPath, retries = 3) {
    const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
    const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            // 这是网页版编辑稿件时的 API，biliup-rs show 用的是 http://member.bilibili.com/x/client/archive/view 应该也行
            const response = await axios.get(`https://member.bilibili.com/x/vupre/web/archive/view?bvid=${bvid}`, {
                headers: {
                    'Cookie': cookieString
                }
            });

            // 打印调试信息
            console.log(`API 响应: message=${response.data.message}, ttl=${response.data.ttl}, 审核状态=${response.data.data.archive.state_desc}`);

            // 检查 API 返回的 code 是否为 0，表示成功
            if (response.data.code === 0) {
                // 返回 cid 和 aid
                return {
                    cid: response.data.data.videos[0].cid,
                    aid: response.data.data.videos[0].aid
                };
            } else {
                // 如果 code 不是 0，抛出错误
                throw new Error('稿件不存在或无法获取信息');
            }
        } catch (error) {
            // 捕获并处理错误
            console.error(`获取视频数据失败 (尝试 ${attempt + 1}/${retries}):`, error.message);
            if (attempt === retries - 1) {
                throw new Error(`获取视频信息失败，已重试 ${retries} 次`);
            }
            // 等待一段时间后重试
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }
}

export async function uploadSrt(aid, oid, cookiesPath, srtPath, lan) {
    try {
        // 读取 cookies 文件
        const cookies = JSON.parse(fs.readFileSync(cookiesPath, 'utf8'));
        
        // 获取 csrf token
        const csrf = cookies.find(cookie => cookie.name === 'bili_jct')?.value;
        if (!csrf) {
            throw new Error('未找到 bili_jct cookie');
        }

        // 准备 cookies 字符串
        const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');

        // 第一步：上传 SRT 文件
        const formData1 = new FormData();
        formData1.append('bucket', 'subtitle');
        formData1.append('file', fs.createReadStream(srtPath));
        formData1.append('csrf', csrf);
        formData1.append('content_type', 'application/x-subrip');

        const timestamp1 = Date.now();
        const uploadResponse = await axios.post(
            `https://api.bilibili.com/x/upload/web/image?t=${timestamp1}&csrf=${csrf}`,
            formData1,
            {
                headers: {
                    ...formData1.getHeaders(),
                    'Cookie': cookieString
                }
            }
        );

        console.log(`上传 SRT 文件响应: message=${uploadResponse.data.message}, ttl=${uploadResponse.data.ttl}`);

        if (uploadResponse.data.code !== 0) {
            throw new Error(`上传 SRT 文件失败: ${uploadResponse.data.message}`);
        }

        const location = uploadResponse.data.data.location;
        const etag = uploadResponse.data.data.etag;

        // 第二步：保存字幕信息
        const formData2 = new FormData();
        formData2.append('oid', oid);   // 这个就是 cid，如果是在投稿时一起上传字幕的话，是从 https://member.bilibili.com/preupload API 返回的 biz_id 获得的
        formData2.append('type', '1');
        formData2.append('files', JSON.stringify([{
            url: location,
            lan, // 参考 subtitle_lan.json 里面的含义，来源 https://i0.hdslb.com/bfs/subtitle/subtitle_lan.json
            subtitle_id: 0
        }]));
        formData2.append('aid', aid);   // 如果是在投稿时一起上传字幕的话，aid 为 0（估计是因为那时还拿不到 bvid 和 aid），但这里会始终填实际值
        formData2.append('csrf', csrf);

        const timestamp2 = Date.now();
        const saveResponse = await axios.post(
            `https://api.bilibili.com/x/v2/dm/subtitle/draft/preSave?t=${timestamp2}&csrf=${csrf}`,
            formData2,
            {
                headers: {
                    ...formData2.getHeaders(),
                    'Cookie': cookieString
                }
            }
        );

        console.log(`保存字幕信息响应: message=${saveResponse.data.message}, ttl=${saveResponse.data.ttl}`);

        if (saveResponse.data.code !== 0) {
            throw new Error(`保存字幕信息失败: ${saveResponse.data.message}`);
        }

        return {
            success: true,
            location,
            etag
        };

    } catch (error) {
        console.error('上传字幕失败:', error.message);
        throw error;
    }
}

// 主函数：处理完整的字幕上传流程
export async function uploadSubtitleByBvid(bvid, cookiesPath, srtPath, lan) {
    try {
        // 1. 获取视频信息（cid 和 aid）
        console.log(`正在获取视频 ${bvid} 的信息...`);
        const { cid, aid } = await checkVideoExistsAndGetInfo(bvid, cookiesPath);
        if (!cid || !aid) {
            throw new Error(`无法获取视频 ${bvid} 的信息`);
        }
        console.log(`成功获取信息: cid=${cid}, aid=${aid}`);

        // 2. 上传字幕
        console.log('开始上传字幕...');
        const result = await uploadSrt(aid, cid, cookiesPath, srtPath, lan);
        console.log('字幕上传成功！');

        return {
            bvid,
            cid,
            aid,
            ...result
        };
    } catch (error) {
        console.error('字幕上传流程失败:', error.message);
        throw error;
    }
}

// 命令行参数处理
const args = process.argv.slice(2);
if (args.length < 2 || args.length > 3) {
    console.log('用法: node upload_srt.js <bvid> <subtitlePath> [lan] (可选值见 subtitle_lan.json，默认: zh-Hans 即中文简体)');
    process.exit(1);
}

// 默认语言为中文简体
// 参考 subtitle_lan.json 里面的含义，来源 https://i0.hdslb.com/bfs/subtitle/subtitle_lan.json
const [bvid, subtitlePath, lan = 'zh-Hans'] = args;
const cookiesPath = './cookies.json';  // 默认的 cookies 文件路径

uploadSubtitleByBvid(bvid, cookiesPath, subtitlePath, lan)
    .then(result => {
        console.log('程序执行完成，字幕已成功上传到B站:', result);
    })
    .catch(error => {
        console.log('程序执行完成，字幕上传过程中遇到错误:', error.message);
    }); 