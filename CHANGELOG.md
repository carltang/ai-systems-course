# 更新记录 · Changelog

第一次发布是 1.0，之后每更新一次，小版本号加一。The first publication was 1.0; each update since raises the minor number by one.

## 1.14（2026-11-28）

1.1 加上选读“权重共享：一组权重用在很多位置，梯度怎么算”，带一个算出来的例子；正文里那句先说清权重共享是什么。

Unit 1.1 gains a further reading, "weight sharing: one set of weights in many places, and its gradient", with a worked example; the sentence in the lesson now says first what weight sharing is.

## 1.13（2026-11-28）

选读：讲解里一笔带过、读了会追问的地方，卡片下面加上可以展开的选读，带推导、小例子和能自己跑的代码。先是五处：0.2 的“MFU 为什么到不了 100%”和“MFU 和吞吐什么时候反着走”，0.3 的“共享内存还剩哪些开销”，1.5 的“反向为什么约是前向的两倍”和“6N 在哪里不准”，配两张新图。改正两处不准确的说法（词嵌入让 6N 高估的条件；MFU 的盲区）；列表里的强调不再显示成星号；版本记录补上 1.0 之前的 alpha、beta 两个阶段。

Further reading: where a lesson passes over a point a reader would ask about, a fold under the card now works it through, with a small example and code to run. The first five: in 0.2, why MFU never reaches 100% and when MFU and throughput move apart; in 0.3, what shared memory still costs; in 1.5, why the backward pass costs about twice the forward and where 6N is off; with two new drawings. Two inaccurate statements corrected (when the embedding table makes 6N overestimate; MFU's blind spot); emphasis in lists no longer shows as asterisks; the version history gains the alpha and beta stages before 1.0.

## 1.12（2026-11-28）

英文版：45 个单元、83 张图和 36 个交互演示都有了英文，每页顶部可以在中英文之间切换，停在同一处并记住选择；演示的控件都显示自己的状态（初始化的几种情况改成切换按钮，检查点间隔已是最优时直接写明）；页脚和这一页加上版本号。

The English edition: all 45 units, 83 drawings and 36 interactive demos in English, with a switch at the top of every page that keeps your place and remembers your choice; every demo control shows its state (the initialisation cases as a toggle, the checkpoint interval says when it is already the best); version numbers in the footer and on this page.

## 1.11（2026-11-28）

反向传播演示的播放按钮显示它是在播放还是暂停，并加了“重来”。

The backpropagation demo's play button shows whether it is playing, and a Restart button.

## 1.10（2026-11-28）

又 10 个交互演示，配在讲解用一长段文字描述机制的地方：反向传播、初始化、注意力、张量的视图、异步执行、归约、在线 softmax、按哈希选路、集合通信、成组调度。

Ten more interactive demos where a lesson describes a mechanism in a long paragraph: backpropagation, initialisation, attention, tensor views, asynchronous execution, reduction, online softmax, routing by hash, collectives and gang scheduling.

## 1.9（2026-11-28）

第 1.1 单元加上“深度就是折叠”的交互演示，UDL 写出全名并链接作者免费提供的全书；全屏阅读翻页后仍是阅读版式；署名改为“编著”。

Unit 1.1 gains a live demo of depth as folding, and UDL is named in full with a link to the author's free edition; full-screen reading stays in reading layout after a page turn; the Chinese byline now says the course was compiled from published sources.

## 1.8（2026-11-27）

夜间模式；翻页按方向滑动；折叠的内容展开、收起更平滑。

Night mode; page turns slide the way you go; folds open and close smoothly.

## 1.7（2026-11-27）

又 7 个交互演示；全部 25 个在手机、iPad、笔记本和大屏上逐一检查。

Seven more interactive demos; all 25 checked on phones, iPads, laptops and large screens.

## 1.6（2026-11-27）

又 12 个交互演示；代码块上色；一步训练的管道按讲解的六步编号；手机上不再横向滚动；演示的高度不随选项变化。

Twelve more interactive demos; coloured code; the training pipeline numbered as the lesson's six steps; no sideways scrolling on phones; demos keep one height whatever you choose.

## 1.5（2026-11-27）

样式表和脚本的地址带上版本，浏览器会取到新的。

The stylesheet and scripts carry a version in their addresses, so browsers fetch the new ones.

## 1.4（2026-11-27）

六张图换成可以动手的交互演示；阅读页换成更冷静的无衬线排版和配色。

Six drawings become hands-on interactive demos; a cooler, sans-serif reading page.

## 1.3（2026-11-27）

修正图上署名里 & 的转义。

Fixed the escaping of the ampersand in the drawings' credit.

## 1.2（2026-11-27）

署名改为“Zongyao Tang 与 Claude 合著”。

The Chinese byline reworded as a joint work.

## 1.1（2026-11-27）

凡是写作者的地方都写上 Claude。

Claude named wherever the author is named.

## 1.0（2026-11-27）

第一次发布：45 个单元、81 张图；作者与 CC BY-NC-SA 4.0 许可，每张图带署名。

First publication: 45 units and 81 drawings; the author, the CC BY-NC-SA 4.0 licence and a credit on every drawing.

## beta（2026-10-28 – 2026-11-27）

Claude 加入以后，在本地应用里把这门课搭起来：从学习路径开始，重排成 12 个部分、45 个单元，每个单元写成讲解、精华卡和图。没有对外发布。

After Claude joined, the course was built inside the local app: from learning paths to 12 parts and 45 units, each written as a lesson with cards and drawings. Not published.

## alpha（2026-07-09 – 2026-09-09）

Claude 加入之前的知识助手：一个在本地查词、整理学习资料的工具，还没有这门课。

The knowledge assistant before Claude joined: a local tool for looking words up and organising study material, before this course existed.

