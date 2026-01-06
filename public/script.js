let settings;
let currentIndex;
let Schluessel;

// let temperature; //设置温度 (范围通常为 0.0 - 1.0)
// let topP; //设置 Top-P (范围通常为 0.0 - 1.0)
// let topK; //设置 Top-K (通常为正整数)

import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';
const MODEL_GEMINI_2_FLASH = "gemini-2.5-flash-lite";
const MODEL_GEMINI_2_5_PRO_EXP_03_25 = "gemini-2.5-pro-exp-03-25";
//这是一个公开实验性 Gemini 模型，默认情况下思考模式始终处于开启状态。
const MODEL_GEMINI_2_FLASH_IMAGE_GENERATION = "gemini-2.0-flash-exp-image-generation";


// 这是 Gemini 2.0 Flash 模型的图像生成版本，适用于图像生成任务。
//gemini-2.0-flash-thinking-exp-01-21 ：这是 Gemini 2.0 Flash Thinking 模型背后的模型的最新预览版
let max_token = 1000000; //设置最大输出令牌数
let chatHistory = JSON.parse(localStorage.getItem('chatHistory')) || [];// 加载历史
// console.log(chatHistory);
const safetySettings = [{
    category: "HARM_CATEGORY_HARASSMENT",
    threshold: "BLOCK_NONE"
},
{
    category: "HARM_CATEGORY_HATE_SPEECH",
    threshold: "BLOCK_NONE"
},
{
    category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
    threshold: "BLOCK_NONE"
},
{
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    threshold: "BLOCK_NONE"
},
{
    category: "HARM_CATEGORY_CIVIC_INTEGRITY",
    threshold: "BLOCK_NONE"
}];

// 页面初始化时加载
// document.addEventListener('DOMContentLoaded', loadSettings);
let isSettingsLoaded = false; // 添加标志位，表示 settings 是否加载完成
async function loadSettings() {
    try {
        const response = await fetch('/settings', {
            headers: {
                'X-Requested-With': 'XMLHttpRequest'
            }
        });
        if (!response.ok) {
            console.error('获取settings数据失败:', response.status, response.statusText);
            sendButton.disabled = true;
            isSettingsLoaded = false;
            return; // 退出函数，不再尝试解析 JSON
        }
        const data = await response.json();
        if (data.settings_values) {
            settings = data.settings_values;
            settings = settings.split(',');
            console.log('Length: ' + settings.length);
            sendButton.disabled = false;
            isSettingsLoaded = true; // 设置标志位
        } else {
            sendButton.disabled = true; // 禁用发送按钮
        }
    } catch (error) {
        console.error('获取settings数据:', error);
        sendButton.disabled = true; // 禁用发送按钮
        isSettingsLoaded = false;
    }
};

// 页面加载时加载localstorage数据
// document.addEventListener('DOMContentLoaded',     loadChatHistory);
function loadChatHistory() {
    if (chatHistory.length === 0) {
        console.log("没有历史记录可加载");
        return;
    }

    // 清空当前聊天区域（可选）
    chatMessages.innerHTML = '';

    // 过滤并删除包含 "<fullcommand>" 的条目
    let initialLength = chatHistory.length;
    chatHistory = chatHistory.filter((entry) => {
        const role = entry.role;
        const text = entry.parts[0].text; // 假设每条消息只有一个 part
        // 如果是用户消息且包含 "<fullcommand>"，标记为删除
        if (role === "user" && text.includes("<fullcommand>")) {
            // console.log(`删除包含 "<fullcommand>" 的历史记录: ${text}`);
            return false; // 从 chatHistory 中移除
        }
        return true; // 保留其他条目
    });

    // 如果有条目被删除，保存更新后的 chatHistory
    if (chatHistory.length < initialLength) {
        saveChatHistory(); // 更新 localStorage
        // console.log(`已删除 ${initialLength - chatHistory.length} 条包含 "<fullcommand>" 的记录`);
    }

    // 遍历并显示剩余的历史记录
    chatHistory.forEach((entry) => {
        const role = entry.role === "user" ? "user" : "ai";
        const text = entry.parts[0].text;
        updateChat(role, text); // 显示到聊天框
    });

    // 滚动到底部（或根据需求调整）
    chatMessages.scrollTop = chatMessages.scrollHeight;
    console.log("聊天历史已加载，共 " + chatHistory.length + " 条记录");
}

let definedModel;
// 页面加载时加载模型
// document.addEventListener('DOMContentLoaded', initializeModelSelector);
function initializeModelSelector() {
    const modelSelector = document.getElementById('modelSelector');
    const defaultModel = 'gemini-2.5-flash';

    // 从 localStorage 中获取模型值
    const savedModel = localStorage.getItem('selectedModel') || defaultModel;
    console.log('当前模型:', savedModel);

    // 设置下拉框的默认值
    modelSelector.value = savedModel;

    // 监听下拉框的变化
    modelSelector.addEventListener('change', () => {
        const selectedModel = modelSelector.value;
        localStorage.setItem('selectedModel', selectedModel); // 更新 localStorage
        console.log(`模型已切换，当前模型为：${selectedModel}`);
        definedModel = selectedModel; // 更新 definedModel
    });

    // 初始化时设置 definedModel
    definedModel = savedModel;

    // // 如果缓存被清空，恢复默认值
    // const clearButton = document.getElementById('clearButton');
    // clearButton.addEventListener('click', () => {
    //     localStorage.removeItem('selectedModel'); // 清除模型设置
    //     modelSelector.value = defaultModel; // 恢复默认值
    //     console.log('缓存已清空，模型恢复为默认值。');
    // });
}


// temperature（0.0 - 1.0）：控制输出的随机性。
// 低值（例如 0.3）：更确定、更可预测的输出，适合翻译。
// 高值（例如 0.9）：更多样、更具创意的输出，适合故事或对话。
// topP（0.0 - 1.0）：控制输出的多样性（核采样）。
// 低值（例如 0.7）：限制生成范围，适合精确任务。
// 高值（例如 0.95）：增加多样性，适合创意任务。
// topK（正整数）：控制考虑的词汇范围。
// 低值（例如 20）：更聚焦，适合翻译。
// 高值（例如 50）：更多选择，适合创意生成。
const commands = [
    {
        label: "润色",
        content: `你是一位很出色英文期刊写作润色大师。
请根据学术论文规范，对单引号中的文本进行润色，使其逻辑清晰、流畅自然。
 需优化段落结构和句子结构，避免冗长复杂的句子，力求简洁明了，提高可读性。 
 运用恰当的过渡词语，增强文章的连贯性。 确保所有表述精准、学术化，避免模糊、含糊或主观臆断，并去除冗余和重复信息，必要时可使用同义词或近义词替换。 
 最终文本需符合学术论文的语言风格，避免口语化表达。
 返回三行：第一行是原文，第二行是编辑后的内容，第三行提供中文解释。此外，在编辑版本中，使用粗体字标记差异.严格按照输出格式的指令输出 \n
 As an English academic paper writing improvement master, 
 your task is to improve the text within the single quotation marks according to academic writing standards, 
 ensuring logical coherence and a smooth, natural flow. 
 Optimize paragraph and sentence structure, avoiding overly long or complex sentences, 
 striving for conciseness and clarity to enhance readability. Employ appropriate transition words to improve cohesion. 
 All statements must be precise and academic in tone, avoiding ambiguity, vagueness, or subjective assertions. 
 Remove redundancy and repetitive information; synonyms or near-synonyms may be used as needed. 
 The final text should adhere to the stylistic conventions of academic papers and avoid colloquialisms. 
 In the result, the first line is the original text, the second line is the edited version, 
 and the third line is the explanation in Chinese. Use the following format:\n
 * **原文:** xxx\n\n* **润色后:** xxx\n\n* **中文说明:** xxx\n\n. Output strictly according to the format instructions.`,
        placeholder: "请输入要润色的文本...",
        Temperature: '0.9',// 创意任务需要更多多样性
        topP: '0.95',
        topK: '50'
    },
    {
        label: "Abstract",
        content: `
        单引号内的内容是一篇英文SCI论文的摘要，请优化，使其符合背景–内容–结论的结构。
        首先，清晰描述研究背景和现有研究的不足（即研究空白），突出该研究的必要性和重要性。
        然后，简要介绍研究方法，并概述核心结果。
        最后，准确阐述研究的主要结论，并强调其对该领域的贡献。保持语言精准、简洁、逻辑清晰、符合学术规范，避免冗长或重复表述。
        返回三行：第一行是原文，第二行是编辑后的内容，第三行提供中文解释。
        此外，在编辑版本中，使用粗体字标记差异。严格按照输出格式的指令输出 \n
        As an English academic paper writing improvement master, 
        your task is to revise the scientific paper abstract (the text within the single quotation marks) to follow the context–content–conclusion structure. 
        Begin by clearly outlining the research background and identifying the gap in existing studies, 
        emphasizing the necessity and significance of the study. 
        Then, concisely describe the methodology and summarize the key findings. 
        Finally, articulate the main conclusions and highlight their contribution to the field. 
        Ensure the language is precise, concise, logically structured, and academically appropriate, 
        avoiding redundancy or overly complex phrasing. Analyze each sentence line by line. 
        In the result, the first line is the original text, the second line is the edited version, and the third line is the explanation in Chinese. 
        Use the following format:
        \n\n* **原文:** xxx\n\n* **修改后:** xxx\n\n* **中文说明:** xxx\n\n. Output strictly according to the format instructions.
`,
        placeholder: "请输入摘要",
        Temperature: '0.9',// 创意任务需要更多多样性
        topP: '0.95',
        topK: '50'
    },
    {
        label: "Introduction",
        content: `
        单引号中的内容的是应为SCI论文的引言，请优化，使其逻辑清晰、衔接顺畅。
        先从研究领域的广泛背景入手，逐步缩小范围至研究问题，明确该研究如何填补现有空白。突出研究的创新性，并在结尾清晰陈述研究目标。
        语言应严谨、学术规范、易于理解，适当使用学术术语，同时避免冗长或复杂句式影响可读性。
        返回三行：第一行是原文，第二行是编辑后的内容，第三行提供中文解释。
        此外，在编辑版本中，使用粗体字标记差异。严格按照输出格式的指令输出 \n
        As an English academic paper writing improvement assistant, your task is to refine the scientific paper introduction (the text within the single quotation marks) to ensure logical clarity and smooth transitions. 
        Start with a broad overview of the research field, gradually narrowing down to the specific research question, and clearly state how this study addresses the existing gap. 
        Highlight the novelty of the research and conclude with a clear articulation of the study’s objectives. 
        Maintain a rigorous, academically appropriate, and reader-friendly tone, using technical terms where necessary while avoiding overly complex sentences that hinder readability. 
        Analyze each sentence line by line. In the result, the first line is the original text, the second line is the edited version, and the third line is the explanation in Chinese. 
        Use the following format:\n* **原文:** xxx\n* **修改后:** xxx\n* **中文说明:** xxx\n. Output strictly according to the format instructions.
        `,
        placeholder: "请输入Introduction",
        Temperature: '0.9',
        topP: '0.95',
        topK: '50'
    },
    {
        label: "Method",
        content: `
        单引号中的内容是英文SCI论文的方法部分，请优化，使其精准、清晰、可复现。
        详细描述实验设计、材料、数据收集与分析方法，确保信息完整，同时避免冗余内容。
        使用逻辑顺序排列步骤，并通过合适的连接词增强段落之间的连贯性。语言应简明、学术化，避免冗长或过度技术化的描述，以提高可读性和复现性。
        返回三行：第一行是原文，第二行是编辑后的内容，第三行提供中文解释。此外，在编辑版本中，使用粗体字标记差异。严格按照输出格式的指令输出 \n
        As an English academic paper writing improvement assistant, your task is to enhance the scientific paper methods section (the text within the single quotation marks) to ensure precision, clarity, and reproducibility. 
        Provide a detailed description of the experimental design, materials, data collection, and analysis methods, ensuring completeness while avoiding unnecessary details. 
        Organize the steps in a logical sequence, using appropriate transitions to maintain coherence. 
        Keep the language concise and academically formal, avoiding excessive technical jargon that might reduce readability and reproducibility. 
        Analyze each sentence line by line. In the result, the first line is the original text, the second line is the edited version, and the third line is the explanation in Chinese. 
        Use the following format:\n* **原文:** xxx\n* **修改后:** xxx\n* **中文说明:** xxx\n. Output strictly according to the format instructions.
        `,
        placeholder: "请输入Method",
        Temperature: '0.9',// 
        topP: '0.95',
        topK: '50'
    },
    {
        label: "Conclusion",
        content: `
        单引号中的内容是应为SCI论文的结论部分，请优化，使其紧密围绕研究目标，总结核心发现，并突出贡献。避免简单重复结果，而是要解释发现的意义，并探讨其对该领域的影响。
        同时，简要指出研究的局限性，并提出未来研究方向。语言应清晰、学术严谨，确保信息的连贯性和可读性。
        返回三行：第一行是原文，第二行是编辑后的内容，第三行提供中文解释。此外，在编辑版本中，使用粗体字标记差异。严格按照输出格式的指令输出 \n
        As an English academic paper writing improvement assistant, your task is to refine the scientific paper conclusion (the text within the single quotation marks) to ensure it directly addresses the research objectives, summarizes key findings, and highlights contributions. 
        Avoid merely repeating results; instead, interpret their significance and discuss their implications for the field. 
        Briefly acknowledge the study’s limitations and suggest directions for future research. Maintain clarity, academic rigor, and coherence, ensuring readability and logical flow. 
        Analyze each sentence line by line. In the result, the first line is the original text, the second line is the edited version, and the third line is the explanation in Chinese. 
        Use the following format:\n
        * **原文:** xxx\n* **修改后:** xxx\n* **中文说明:** xxx\n. Output strictly according to the format instructions.
        `,
        placeholder: "请输入Conclusion",
        Temperature: '0.9',// 
        topP: '0.95',
        topK: '50'
    },

    {
        label: "润色-分行显示",
        content: `
        As an English academic paper writing improvement assistant, your task is to improve the spelling, grammer, clarity, conciseness and the overall readability of the text provided (the text within the single quotation marks), while breaking down long sentences. 
        Analyze each sentence line by line. In the result, the first line is the original text, the second line is the edited version, and the third line is the explanation in Chinese. 
        Use the following format:\n
        * **原文:** xxx\n* **修改后:** xxx\n* **中文说明:** xxx\n. Output strictly according to the format instructions.
        `,
        placeholder: "请输入要润色的内容",
        Temperature: '0.9',// 
        topP: '0.95',
        topK: '50'
    },
    {
        label: "润色-分列显示",
        content: `
        As an English academic paper writing improvement assistant, your task is to improve the spelling, grammer, clarity, conciseness , logical coherence, and the overall readability of the text provided (the text within the single quotation marks), while breaking down long sentences. 
        You will return three colums. The first column is the original sentence, and the second column is the sentense after eidting, and the third column provides the expannation in Chinese. 
        In addtion, in the edited version, mark the difference using bold font. 
        Output strictly according to the format instructions.
        `,
        placeholder: "请输入要润色的内容",
        Temperature: '0.9',// 
        topP: '0.95',
        topK: '50'
    },

    {
        label: "翻译",
        content: `
        请自动帮我检测单引号中内容的语言（中文，英文中的一种），并自动翻译成另外一种语言。按照以下格式输出：\n
        检测到的语言：中文 \n\n**翻译：** \n\n* **英文:** stapler \n
        `,
        placeholder: "请输入要翻译的内容",
        Temperature: '0.3',// 
        topP: '0.7',
        topK: '20'
    },

    {
        label: "同义词替换",
        content: `
        Provide synonyms or near-synonyms of the content within the single quotation marks
        `,
        placeholder: "请输入词汇",
        Temperature: '0.9',// 
        topP: '0.95',
        topK: '50'
    },


    {
        label: "短文：英译中",
        content: "请将单引号中的英文短文翻译成中文。在每句英文下面一行附上对应的中文句子。请严格按照输出指令来输出。",
        placeholder: "请输入要翻译的英文...",
        Temperature: '0.3',
        topP: '0.7',
        topK: '20'
    },
    // {
    //     label: "德语词汇精讲",
    //     content: "单引号中的是上面文章（对话）中的一些词汇，我不理解其含义和用法。请用简明易懂的【中文】解释它们的含义，并尽可能提供德语例句（例句难度控制在A1-B1水平）来说明其在不同语境下的用法。如果某个词有多种含义，请分别解释。",
    //     placeholder: "请输入要解释的词汇...",
    //     Temperature: '0.3',// 翻译任务需要更高的确定性
    //     topP: '0.7',
    //     topK: '20'
    // },

    {
        label: "其他",
        content: "\n请用中文回答。",
        placeholder: "这里可以随便输入点什么...",
        Temperature: '0.5',// 这里一般是写代码或者问一些一般的问题
        topP: '0.7',
        topK: '30'
    },

    {
        label: "清除历史对话",
        content: "清除历史对话",
        placeholder: "点击下方《发送》按钮确认清除历史对话，并自动刷新页面",
        Temperature: '0.5',// 这里一般是写代码或者问一些一般的问题
        topP: '0.7',
        topK: '30'
    },
];

// document.addEventListener('DOMContentLoaded', () => {
//     createCommandButtons(commands);
// });

let activeButton = null;
// 创建按钮的函数
function createCommandButtons(commands) {
    const buttonContainer = document.getElementById('commandButtons');

    commands.forEach(command => {
        if (command.label === '--') return;

        const button = document.createElement('button');
        button.className = 'command-button';
        button.textContent = command.label;
        button.addEventListener('click', () => {
            // 取消其他按钮的激活状态
            document.querySelectorAll('.command-button').forEach(btn => {
                btn.classList.remove('active');
            });

            // 设置当前按钮为激活状态
            button.classList.add('active');
            activeButton = command;

            // 更新输入框的 placeholder
            userInput.placeholder = command.placeholder;
            userInput.focus(); // 聚焦到输入框

            // 如果是清除历史对话按钮，立即处理
            if (command.label === '清除历史对话') {
                if (confirm('这会删除当前以及之前的所有会话内容，确定吗？')) {
                    localStorage.clear();
                    location.reload(true);
                    // alert("历史对话已删除");
                }
                // 重置 activeButton
                button.classList.remove('active');
                activeButton = null;
                userInput.placeholder = ''; // 重置 placeholder
            }
        });
        buttonContainer.appendChild(button);
    });
}


let recognition; // 语音识别对象
let isRecording = false;
const userInput = document.getElementById("userInput");
const microphoneButton = document.getElementById('microphoneButton');
const stopButton = document.getElementById('stopButton');
// 检查浏览器是否支持语音识别 API
if ('webkitSpeechRecognition' in window) {
    recognition = new webkitSpeechRecognition();
    recognition.continuous = true; // 持续识别
    recognition.interimResults = true; // 显示临时结果
    recognition.lang = 'zh-CN'; // 设置语言为中文，提高识别准确率

    recognition.onstart = () => {
        isRecording = true;
        microphoneButton.classList.add('recording'); // 添加动画
        stopButton.classList.remove('hidden'); //显示停止按钮
        console.log('语音识别已启动');
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript + ',';
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        // 将新的识别结果添加到输入框的现有内容中
        userInput.value += finalTranscript;
        // userInput.value += interimTranscript;
    };

    recognition.onerror = (event) => {
        console.error('语音识别出错:', event.error);
        if (event.error === 'no-speech' || event.error === 'aborted') {
            console.log('尝试重新启动语音识别...');
            recognition.start();
        } else {
            stopRecording(); // 停止录音
        }

        let errorMessage = '语音识别出错: ';
        switch (event.error) {
            case 'no-speech':
                errorMessage += '未检测到语音.';
                break;
            case 'aborted':
                errorMessage += '语音识别被中止.';
                break;
            case 'audio-capture':
                errorMessage += '无法访问麦克风.';
                break;
            case 'network':
                errorMessage += '网络连接错误.';
                break;
            case 'not-allowed':
                errorMessage += '没有麦克风权限，请检查浏览器设置.';
                break;
            case 'service-not-allowed':
                errorMessage += '语音识别服务不允许.';
                break;
            default:
                errorMessage += '未知错误.';
        }
        // apiResponseTextarea.value = errorMessage; // 将错误信息显示在API响应区域
    };

    recognition.onend = () => {
        isRecording = false;
        microphoneButton.classList.remove('recording'); // 移除动画
        stopButton.classList.add('hidden'); //隐藏停止按钮
        console.log('语音识别已结束');

        // 自动重新启动语音识别
        if (isRecording) {
            console.log('重新启动语音识别...');
            recognition.start();
        }
    };


    // 封装语音识别的启动和停止功能
    function toggleSpeechRecognition() {
        if (!isRecording) {
            // 开始录音
            // userInput.value = ''; // 录音前清空输入框
            recognition.start();
        } else {
            // 停止录音
            recognition.stop();
        }
    }

    // 为话筒和停止按钮绑定同一个事件处理函数
    microphoneButton.addEventListener('click', toggleSpeechRecognition);
    stopButton.addEventListener('click', toggleSpeechRecognition);
} else {
    alert('您的浏览器不支持语音识别 API');
}

//清除输入框内容
const clearButton = document.getElementById('clearButton');
clearButton.addEventListener('click', () => {
    userInput.value = ''; // 清空输入框内容
    userInput.focus(); // 将焦点放回输入框
})
//发送消息
const sendButton = document.getElementById('sendButton');

sendButton.addEventListener('click', async () => {
    // 确保 settings 已加载
    if (!isSettingsLoaded) {
        await loadSettings(); // 等待加载完成
        if (!isSettingsLoaded) {
            alert('设置加载失败，请稍后重试！');
            return;
        }
    }

    if (!activeButton) {
        alert('请先选择一个功能按钮！');
        return;
    }

    const userText = userInput.value.trim();

    let Temperature = parseFloat(activeButton.Temperature);
    let topP = parseFloat(activeButton.topP);
    let topK = parseFloat(activeButton.topK);

    if (activeButton.content.includes("代码") || activeButton.content.includes("daima")) {
        Temperature = 0.15;
        topP = 0.3;
        topK = 5;
    }

    if (!userText) {
        alert('请输入内容！');
        userInput.focus();
        return;
    }

    let button_label = activeButton.label;
    let symbol = "'"
    // const fullCommand = symbol + userText + symbol + activeButton.content;
    let fullCommand;
    if (button_label === "生成图片") {
        fullCommand = userText;
    }
    else {
        fullCommand = `<fullcommand>: +${symbol}${userText}${symbol}${activeButton.content}`;
    }
    (async () => {
        userInput.value = ''; // 立即清空
        let modelName;
        if (button_label === "生成图片") {
            modelName = MODEL_GEMINI_2_FLASH_IMAGE_GENERATION; // 对应图片生成模型
        } else if (button_label === "其他") {
            modelName = definedModel; // 对应默认模型
        } else {
            modelName = definedModel; // 对应其他模型
        }

        // console.log(`Button: ${button_label}, Model: ${modelName}`);
        if (button_label === "生成图片") {
            await generateImg(userText, fullCommand, button_label, Temperature, topP, topK, modelName)
        }
        else {
            await sendMessageToAPI(userText, fullCommand, button_label, Temperature, topP, topK, modelName);
            console.log(`Button: ${button_label}, Model: ${modelName}`);
        }
    })();

});

// 添加ctrl+回车发送功能
userInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.ctrlKey) {
        event.preventDefault();
        sendButton.click();
    }
});
//焦点在输入框之外，按下回车键，发送内容
// document.addEventListener('keydown', (event) => {
//     if (event.key === 'Enter' && !event.shiftKey) {
//         event.preventDefault();
//         sendButton.click();
//     }
// });

async function sendMessageToAPI(userinput, message, button_label, Temperature, topP, topK, model_name) {
    const userText = userinput.trim();
    updateChat('user', userText)

    // 将用户消息添加到历史记录
    chatHistory.push({
        role: "user",
        parts: [{ text: marked.parse("<strong>" + button_label + ": \n\n" + "</strong>" + userText) }]
    });

    // 添加“思考中”的消息
    const tmpMessage = updateChat('ai', '思考中，请等待...');

    if (!isSettingsLoaded) {
        // 如果 settings 未加载完成，等待 loadSettings 执行
        await loadSettings();
        if (!isSettingsLoaded) {
            updateChat("ai", "⚠️ 设置加载失败，请稍后重试。");
            return;
        }
    }
    let retries = settings.length;
    let validSchluesselFound = false; // 添加标志位

    let generationConfigs = {
        maxOutputTokens: max_token,
        temperature: Temperature,
        topP: topP,
        topK: topK
    };

    while (retries > 0 && !validSchluesselFound) {//循环条件
        let retries_no = settings.length - retries + 1;
        // console.log(`第${retries_no}次尝试: `);
        try {
            currentIndex = Math.floor(Math.random() * settings.length);
            console.log('current key No.: ', currentIndex);
            Schluessel = settings[currentIndex];

            const genAI = new GoogleGenerativeAI(Schluessel);
            let model = genAI.getGenerativeModel({ model: model_name });
            // console.log(chatHistory);
            const chat = model.startChat({//这里没有声明关键字（let 或 const），直接使用了外层的 let chat。
                history: chatHistory,
                generationConfig: generationConfigs,
                safetySettings: safetySettings,
            });

            const result = await chat.sendMessage(message);
            const response = await result.response;
            const aiMessage = response.text();

            tmpMessage.remove();
            updateChat('ai', aiMessage);

            validSchluesselFound = true; // 设置标志位
            return;
        } catch (error) {
            console.error("出现错误: ", error);
            //  更精确的错误处理 (例如检查 HTTP 状态码)
            currentIndex = (currentIndex + 1) % settings.length;
            // genAI = new GoogleGenerativeAI(Schluessel);
            // model = genAI.getGenerativeModel({ model: model_name });
            // chat = model.startChat({
            //     history: chatHistory,
            //     generationConfig: generationConfigs,
            //     safetySettings: safetySettings,
            // });
            retries--;
            await new Promise(resolve => setTimeout(resolve, 2000)); // 增加延迟
            //console.error(error);
        }
    }
    if (!validSchluesselFound) { //  根据标志位判断
        tmpMessage.remove();
        updateChat("ai", "⚠️ 所有 API Key 均不可用，请稍后刷新重试。");
    }
}

async function generateImg(userinput, message, button_label, Temperature, topP, topK, model_name_for_img) {
    const userText = userinput.trim();
    updateChat('user', userText)

    // 将用户消息添加到历史记录
    chatHistory.push({
        role: "user",
        parts: [{ text: marked.parse("<strong>" + button_label + ": \n\n" + "</strong>" + userText) }]
    });

    // 添加“思考中”的消息
    const tmpMessage = updateChat('ai', '图片生成中，请等待...');

    if (!isSettingsLoaded) {
        // 如果 settings 未加载完成，等待 loadSettings 执行
        await loadSettings();
        if (!isSettingsLoaded) {
            updateChat("ai", "⚠️ 设置加载失败，请稍后重试。");
            return;
        }
    }
    let retries = settings.length;
    let validSchluesselFound = false; // 添加标志位

    let generationConfigs = {
        maxOutputTokens: max_token,
        temperature: Temperature,
        topP: topP,
        topK: topK,
        responseModalities: ['Text', 'Image'] // 添加图片支持
    };

    while (retries > 0 && !validSchluesselFound) {//循环条件
        let retries_no = settings.length - retries + 1;
        // console.log(`第${retries_no}次尝试: `);
        try {
            currentIndex = Math.floor(Math.random() * settings.length);
            console.log('current key No.: ', currentIndex);
            Schluessel = settings[currentIndex];

            const genAI = new GoogleGenerativeAI(Schluessel);
            let model = genAI.getGenerativeModel({
                model: model_name_for_img,
                history: chatHistory,
                generationConfig: generationConfigs,
                safetySettings: safetySettings,
            });
            // console.log(chatHistory);

            // const chat = model.startChat({//这里没有声明关键字（let 或 const），直接使用了外层的 let chat。
            //     history: chatHistory,
            //     generationConfig: generationConfigs,
            //     safetySettings: safetySettings,
            // });
            // const result = await chat.sendMessage(message);

            let result = await model.generateContent(message);
            const response = await result.response;

            // 处理响应中的文本和图片
            let aiMessage = '';
            const candidates = response.candidates[0].content.parts;
            // 处理文本和图片
            if (response.candidates && response.candidates[0]?.content?.parts) {
                for (const part of response.candidates[0].content.parts) {
                    if (part.text) {
                        aiMessage += part.text;
                    } else if (part.inlineData) {
                        const imageData = part.inlineData.data;
                        const mimeType = part.inlineData.mimeType;
                        const imageUrl = `data:${mimeType};base64,${imageData}`;
                        console.log('picture generated');
                        displayImageInChat(imageUrl); // 显示图片
                        updateChat('ai', "⚠️**图片无法被保存进本地缓存，请及时导出！**");
                    }
                }
            } else {
                console.log("响应数据格式不正确，无法生成图片");
            }

            tmpMessage.remove();
            // updateChat('ai', aiMessage);

            validSchluesselFound = true; // 设置标志位
            return;
        } catch (error) {
            console.error("出现错误: ", error);
            //  更精确的错误处理 (例如检查 HTTP 状态码)
            currentIndex = (currentIndex + 1) % settings.length;
            // genAI = new GoogleGenerativeAI(Schluessel);
            // model = genAI.getGenerativeModel({ model: model_name });
            // chat = model.startChat({
            //     history: chatHistory,
            //     generationConfig: generationConfigs,
            //     safetySettings: safetySettings,
            // });
            retries--;
            await new Promise(resolve => setTimeout(resolve, 2000)); // 增加延迟
            //console.error(error);
        }
    }
    if (!validSchluesselFound) { //  根据标志位判断
        tmpMessage.remove();
        updateChat("ai", "⚠️ 所有 API Key 均不可用，请稍后刷新重试。");
    }
}

// 显示图片的函数
function displayImageInChat(imageUrl) {
    const message = document.createElement("div");
    message.classList.add("message", "ai");

    const img = document.createElement("img");
    img.src = imageUrl;
    img.style.maxWidth = "100%";
    img.style.borderRadius = "5px";
    img.alt = "生成的图片";

    message.appendChild(img);
    addExportButton(message, imageUrl); // 添加导出按钮支持保存图片

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
// 更新聊天的函数
const chatMessages = document.getElementById("chatMessages");
const chatSection = document.getElementById("chatSection");

function updateChat(role, text) {
    const message = document.createElement("div");
    message.classList.add("message", role);
    // const html = marked.parse(text);

    if (role === 'ai') {
        text = text + "\n\n**本站不保存数据，仅缓存在浏览器中，请及时保存！**";//添加提示信息
        // 解析文本中的德语内容
        let html = marked.parse(text);
        message.innerHTML = html;
        // console.log(html);
        // 只在 AI 角色时保存文本到 chatHistory
        // chatHistory.push({
        //     role: "ai",
        //     parts: [{ text }]
        // });
        saveChatHistory();
        // addPlayButtons(message);//添加语音播放按钮
        addExportButton(message, text); // 添加导出按钮
    } else {
        let html = marked.parse(text);
        message.innerHTML = html;

        addCopyButton(message, text); // 添加复制按钮
    }

    addDeleteButton(message, text); // 添加导出按钮

    chatMessages.appendChild(message);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    // saveChatHistory(); // 保存到 localStorage
    return message; // 返回创建的 message 元素
}

// 保存历史
function saveChatHistory() {
    localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

function addExportButton(message, content) {
    const exportButton = createButton("导出", "#28a745"); // 创建导出按钮
    exportButton.addEventListener("click", () => {
        // 判断 content 是否为图片 URL
        if (content.startsWith('data:image/')) {
            exportImage(content); // 导出图片
        } else {
            exportFile(content); // 导出文本
        }
    });
    message.appendChild(exportButton);// 添加按钮到消息块中
}

function addCopyButton(message, text) {
    const copyButton = createButton("复制", "#007bff"); // 创建复制按钮
    copyButton.addEventListener("click", () => {
        copyText(text)
    }); // 绑定事件
    message.appendChild(copyButton);// 添加按钮到消息块中
}

function addDeleteButton(message, text) {
    const deleteButton = createButton("删除", "#dc3545");
    deleteButton.addEventListener("click", () => {
        deleteBlock(message, text)
    })
    message.appendChild(deleteButton);
}


function createButton(text, backgroundColor) {
    const button = document.createElement("button");
    button.textContent = text;
    button.style.marginLeft = "10px";
    button.style.padding = "5px 10px";
    button.style.fontSize = "12px";
    button.style.cursor = "pointer";
    button.style.backgroundColor = backgroundColor;
    button.style.color = "white";
    button.style.border = "none";
    button.style.borderRadius = "5px";
    return button;
}

async function exportFile(text) {
    const defaultName = `AI_Response_${Date.now()}.txt`;// 默认文件名
    if (window.showSaveFilePicker) {
        try {
            // 配置文件选择对话框
            const options = {
                suggestedName: defaultName,
                types: [{ description: "Text Files", accept: { "text/plain": [".txt"] } }],
            };
            // 调用文件选择器
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();
            // 写入内容到文件并关闭
            await writable.write(text);
            await writable.close();
            console.log("文件已成功保存！");
        } catch (error) {
            console.error("用户取消或保存失败：", error);
        }
    } else {
        // 浏览器不支持 showSaveFilePicker，使用 prompt 获取文件名
        const userFileName = prompt("请输入导出文件名（无需扩展名）", defaultName.replace(".txt", ""));
        const fileName = userFileName ? `${userFileName}.txt` : defaultName;
        // 调用 Blob 下载方式
        exportToBlob(fileName, text);
    }
}

function exportToBlob(filename, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    // 模拟点击下载
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log("文件已通过 Blob 保存！");
}

async function exportImage(imageUrl) {
    const defaultName = `Generated_Image_${Date.now()}.png`; // 默认图片文件名

    if (window.showSaveFilePicker) {
        try {
            // 配置文件选择对话框
            const options = {
                suggestedName: defaultName,
                types: [{ description: "PNG Image", accept: { "image/png": [".png"] } }],
            };
            const handle = await window.showSaveFilePicker(options);
            const writable = await handle.createWritable();

            // 将 Base64 转换为 Blob
            const response = await fetch(imageUrl);
            const blob = await response.blob();

            // 写入文件并关闭
            await writable.write(blob);
            await writable.close();
            console.log("图片已成功保存！");
        } catch (error) {
            console.error("用户取消或保存失败：", error);
        }
    } else {
        // 浏览器不支持 showSaveFilePicker，使用 Blob 下载
        const userFileName = prompt("请输入导出文件名（无需扩展名）", defaultName.replace(".png", ""));
        const fileName = userFileName ? `${userFileName}.png` : defaultName;

        // 将 Base64 转换为 Blob 并下载
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log("图片已通过 Blob 保存！");
    }
}

function copyText(text) {
    navigator.clipboard.writeText(text)// 使用navigator.clipboard API复制文本
        .then(() => {
            console.log("文本已复制到剪贴板");
            userInput.value = text; //  点击按钮后文本自动填充到输入框
        })
        .catch(err => {
            console.error("复制到剪贴板失败: ", err);
            //alert("复制到剪贴板失败！");
        });
}

function deleteBlock(messageElement, text) {
    if (confirm('确定删除该条记录吗？')) {
        messageElement.remove();
        //location.reload(true);
        alert("已删除");
    }
    const role = messageElement.classList.contains('user') ? 'user' : 'model';

    const index = chatHistory.findIndex(entry => {
        const entryText = entry.parts[0].text;
        // console.log('entry.role: ',entry.role);
        // 根据角色匹配消息内容
        if (entry.role === role) {
            if (role === 'user') {
                // 用户消息可能包含格式化标签，比较原始文本
                return entryText.includes(text) || marked.parse(entryText).includes(text);
            } else {
                // console.log('entryText: ', entryText);
                // console.log('text: ', text);
                // AI 消息直接比较
                return text.includes(entryText) || marked.parse(text).includes(entryText);
            }
        }
        return false;
    });
    if (index !== -1) {
        chatHistory.splice(index, 1);// 从 chatHistory 中删除
        saveChatHistory();// 保存更新后的历史
        console.log(`已删除记录 ${index}`);
    } else {
        console.log("记录不存在");
    }
}

function addPlayButtons(message) {
    const germanSentences = message.querySelectorAll('p');

    germanSentences.forEach(element => {
        const text = element.textContent.trim(); // trim() 去除多余空格
        if (text.match(/[äöüßÄÖÜ]|[a-zA-Z]/)) { // // 检查文本是否非空且包含德语或英文字符（简单判断）
            const playButton = document.createElement('button');
            playButton.className = 'play-button';
            playButton.innerHTML = '<i class="fas fa-volume-up"></i>';//初始为播放图标
            let utterance = null;// 用于跟踪此按钮关联的朗读实例

            playButton.addEventListener('click', () => {

                if (speechSynthesis.speaking && !speechSynthesis.paused) {
                    speechSynthesis.cancel();
                    playButton.classList.remove('stop');
                    playButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                } else {
                    utterance = new SpeechSynthesisUtterance(text);
                    utterance.lang = 'de-DE';
                    utterance.rate = 0.75; // 设置语速（1 为正常语速）
                    utterance.pitch = 1; // 设置音调（1 为正常音调）
                    utterance.onend = () => {
                        playButton.classList.remove('stop');
                        playButton.innerHTML = '<i class="fas fa-volume-up"></i>';
                    };
                    speechSynthesis.speak(utterance);// 播放语音
                    playButton.classList.add('stop');
                    playButton.innerHTML = '<i class="fas fa-stop"></i>';
                }
            });
            element.appendChild(playButton);//暂时不添加语音播放按钮
        }
    });
}


// Scroll to Top button functionality (chatMessages)
document.getElementById("scrollTopButton").addEventListener("click", () => {
    chatMessages.scrollTo({ top: 0, behavior: "smooth" });
});

// Scroll to Bottom button functionality (chatMessages)
document.getElementById("scrollBottomButton").addEventListener("click", () => {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: "smooth" });
});


document.addEventListener('DOMContentLoaded', () => {
    initializeModelSelector(); // 初始化模型选择器
    loadSettings(); // 加载设置
    loadChatHistory(); // 加载聊天历史
    createCommandButtons(commands); // 创建功能按钮
});