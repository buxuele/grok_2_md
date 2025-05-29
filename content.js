(function() {
  function htmlToMarkdown(html) {
    let cleanedHtml = html.replace(/<script[^>]*>.*?<\/script>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<style[^>]*>.*?<\/style>/gi, '');
    cleanedHtml = cleanedHtml.replace(/<svg[^>]*>.*?<\/svg>/gi, '');
    for (let i = 0; i < 3; i++) { 
        cleanedHtml = cleanedHtml.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
    }
    cleanedHtml = cleanedHtml.replace(/<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi, '\n```\n$1\n```\n');
    cleanedHtml = cleanedHtml.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n');
    cleanedHtml = cleanedHtml.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
    cleanedHtml = cleanedHtml.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, function(match, ulContent) {
        return ulContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch, liContent) => `- ${liContent.trim()}\n`);
    });
    cleanedHtml = cleanedHtml.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, function(match, olContent) {
        let counter = 1;
        return olContent.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (liMatch, liContent) => `${counter++}. ${liContent.trim()}\n`);
    });
    cleanedHtml = cleanedHtml.replace(/<div[^>]*class="[^"]*r-adyw6z[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '\n## $1\n');
    cleanedHtml = cleanedHtml.replace(/<div[^>]*class="[^"]*r-b88u0q[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '**$1**\n');
    cleanedHtml = cleanedHtml.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
    cleanedHtml = cleanedHtml.replace(/<div[^>]*class="[^"]*r-1qd0xha[^"]*"[^>]*>([\s\S]*?)<\/div>/gi, '$1\n\n');
    cleanedHtml = cleanedHtml.replace(/<br\s*\/?>/gi, '\n');
    cleanedHtml = cleanedHtml.replace(/<hr[^>]*>/gi, '\n---\n');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = cleanedHtml;
    let textContent = '';
    tempDiv.childNodes.forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) {
            textContent += node.textContent;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
            if (['PRE', 'CODE'].includes(node.tagName)) {
                 textContent += node.outerHTML; 
            } else {
                textContent += node.innerText || node.textContent || '';
            }
            if (['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR', 'BR', 'UL', 'OL'].includes(node.tagName)) {
                // 在块级元素后尝试添加换行，但要避免在列表项后重复添加（因为ul/ol处理时已加）
                if (!(['LI'].includes(node.tagName) && node.parentElement && ['UL','OL'].includes(node.parentElement.tagName))) {
                     textContent += '\n';
                }
            }
        }
    });
    cleanedHtml = textContent;

    cleanedHtml = cleanedHtml.replace(/\n{3,}/g, '\n\n');
    cleanedHtml = cleanedHtml.replace(/ +\n/g, '\n');
    cleanedHtml = cleanedHtml.replace(/^\s+|\s+$/g, '');
    cleanedHtml = cleanedHtml.replace(/```(\w*)\n([\s\S]+?)\n```/g, (match, lang, code) => {
        return '```' + (lang || '') + '\n' + code.trim() + '\n```';
    });
    return cleanedHtml.trim();
  }

  function copyAsMarkdown(event) {
    const copyButton = event.target.closest('button[aria-label="复制文本"]');
    if (!copyButton) return;
    if (copyButton.closest('[data-testid="markdown-code-block"]')) {
        console.log('LOG: Ignored click on copy button within a code block.');
        return;
    }
    console.log('LOG: Copy button clicked. Button HTML:', copyButton.outerHTML.substring(0, 200) + '...');

    const actionBar = copyButton.closest('div[class*="r-18u37iz"][class*="r-1wtj0ep"]');
    if (!actionBar) {
      console.log('LOG: ActionBar not found.');
      return;
    }
    console.log('LOG: ActionBar found. HTML:', actionBar.outerHTML.substring(0, 200) + '...');

    let currentElementForMessageBlockSearch = actionBar;
    let messageBlock = null;
    let iterationCount = 0;
    const MAX_ITERATIONS = 7; // Max levels to go up to find messageBlock

    while(currentElementForMessageBlockSearch && currentElementForMessageBlockSearch.parentElement && iterationCount < MAX_ITERATIONS) {
        let parent = currentElementForMessageBlockSearch.parentElement;
        console.log(`LOG: Checking parent [${iterationCount}] for messageBlock:`, parent.className, 'HTML:', parent.outerHTML.substring(0,200) + '...');

        let contentCandidate = null;
        let actionBarWrapperCandidate = null;

        for (const child of parent.children) {
            if (child.contains(actionBar)) {
                actionBarWrapperCandidate = child;
            } else if (child.tagName === 'DIV' && 
                       (child.matches('div[class*="r-1wbh5a2"]') || 
                        child.querySelector('div[dir="ltr"], ul, ol, hr, pre, p'))) {
                contentCandidate = child;
            }
        }

        if (contentCandidate && actionBarWrapperCandidate && contentCandidate !== actionBarWrapperCandidate) {
            messageBlock = parent;
            console.log('LOG: Found messageBlock:', messageBlock.className, 'Contains distinct content and action bar wrappers.');
            console.log('LOG:   Content Candidate in messageBlock:', contentCandidate.className);
            console.log('LOG:   ActionBar Wrapper in messageBlock:', actionBarWrapperCandidate.className);
            break; 
        }
        currentElementForMessageBlockSearch = parent;
        iterationCount++;
    }

    if (!messageBlock) {
        console.log('LOG: Could not find a suitable messageBlock after traversing up.');
        return;
    }
    console.log('LOG: Final messageBlock determined:', messageBlock.className, 'HTML:', messageBlock.outerHTML.substring(0, 300) + '...');
    
    let answerContainer = null;
    let contentWrapper = null;

    console.log('LOG: Searching for contentWrapper within messageBlock. Number of children:', messageBlock.children.length);
    for (const child of messageBlock.children) {
      console.log('LOG: Checking messageBlock child: className=`' + child.className + '`, tagName=`' + child.tagName + '`. Is it or does it contain actionBar?', child === actionBar || child.contains(actionBar));
      if (child.tagName === 'DIV' && !(child === actionBar || child.contains(actionBar))) {
          if (child.matches('div[class*="r-1wbh5a2"]') && child.querySelector('div[dir="ltr"], ul, ol, hr, pre, p')) {
              contentWrapper = child;
              console.log('LOG: contentWrapper candidate found by specific class (r-1wbh5a2) and content:', contentWrapper.className);
              break; 
          }
          if (!contentWrapper && child.querySelector('div[dir="ltr"], ul, ol, hr, pre, p')) {
              contentWrapper = child;
              console.log('LOG: contentWrapper candidate (general content markers):', contentWrapper.className);
          }
          if (!contentWrapper) { 
              contentWrapper = child;
              console.log('LOG: contentWrapper candidate (generic fallback):', contentWrapper.className);
          }
      }
    }
     
    if (contentWrapper && !contentWrapper.matches('div[class*="r-1wbh5a2"]')) {
        const specificContentWrapper = Array.from(messageBlock.children).find(
            ch => ch.tagName === 'DIV' && 
                  !(ch === actionBar || ch.contains(actionBar)) && 
                  ch.matches('div[class*="r-1wbh5a2"]') &&
                  ch.querySelector('div[dir="ltr"], ul, ol, hr, pre, p')
        );
        if (specificContentWrapper) {
            console.log('LOG: Corrected contentWrapper to the one with r-1wbh5a2.');
            contentWrapper = specificContentWrapper;
        }
    }

    if (contentWrapper) {
      console.log('LOG: contentWrapper found:', contentWrapper.className, 'HTML:', contentWrapper.outerHTML.substring(0, 300) + '...');
      // The contentWrapper (e.g. <div class="css-175oi2r r-1wbh5a2 ...">) itself contains the structure we need.
      // Its first child is like <div class="css-175oi2r r-3pj75a">
      // And *that* first child is the <div class="css-175oi2r" style="display: block;"> which is our answerContainer
      const intermediateContainer = contentWrapper.firstElementChild;
      if (intermediateContainer && intermediateContainer.tagName === 'DIV') {
        console.log('LOG: intermediateContainer found:', intermediateContainer.className, 'HTML:', intermediateContainer.outerHTML.substring(0,200)+'...');
        const potentialAnswerContainer = intermediateContainer.firstElementChild;
        if (potentialAnswerContainer && potentialAnswerContainer.tagName === 'DIV' &&
            potentialAnswerContainer.classList.contains('css-175oi2r') &&
            potentialAnswerContainer.style.display === 'block' && // Crucial style check
            (potentialAnswerContainer.querySelector(':scope > div[dir="ltr"], :scope > ul, :scope > ol, :scope > hr, :scope > pre, :scope > p'))
           ) {
          answerContainer = potentialAnswerContainer;
          console.log('LOG: answerContainer found by specific path:', answerContainer.className, 'Style:', answerContainer.style.cssText);
        } else {
          console.log('LOG: Specific path for answerContainer failed. Potential AC:', potentialAnswerContainer ? potentialAnswerContainer.className : 'null', 'Style:', potentialAnswerContainer ? potentialAnswerContainer.style.cssText : 'null', 'Content markers?:', potentialAnswerContainer ? !!potentialAnswerContainer.querySelector(':scope > div[dir="ltr"], :scope > ul, :scope > ol, :scope > hr, :scope > pre, :scope > p') : 'null');
        }
      } else {
          console.log('LOG: intermediateContainer (contentWrapper.firstElementChild) not found or not a DIV. Found:', intermediateContainer);
      }

      if (!answerContainer) {
          console.log('LOG: Attempting general search for answerContainer within contentWrapper...');
          const candidates = contentWrapper.querySelectorAll('div.css-175oi2r[style*="display: block;"]'); // More specific class
          console.log('LOG: General search candidates count:', candidates.length);
          for (const cand of candidates) {
              if (cand.querySelector(':scope > div[dir="ltr"], :scope > ul, :scope > ol, :scope > hr, :scope > pre, :scope > p')) {
                  answerContainer = cand;
                  console.log('LOG: answerContainer found by general search:', answerContainer.className, 'Style:', answerContainer.style.cssText);
                  break; 
              }
          }
      }
    } else {
      console.log('LOG: contentWrapper not found.');
    }

    if (!answerContainer) {
      console.log('LOG: answerContainer ultimately NOT FOUND.');
      if(contentWrapper) console.log('LOG: contentWrapper existed. HTML(first 500):', contentWrapper.innerHTML.substring(0,500));
      else if(messageBlock) console.log('LOG: messageBlock existed. HTML(first 500):', messageBlock.innerHTML.substring(0,500));
      return;
    }
    console.log('LOG: answerContainer successfully located:', answerContainer.className, 'HTML:', answerContainer.outerHTML.substring(0, 300) + '...');

    let answerHtml = '';
    if (answerContainer.children.length > 0) {
        for (const childElement of answerContainer.children) {
            if (childElement.tagName === 'HR' || 
                childElement.tagName === 'UL' || 
                childElement.tagName === 'OL' || 
                childElement.tagName === 'PRE' ||
                childElement.tagName === 'P' ||
                (childElement.textContent && childElement.textContent.trim() !== '') || 
                childElement.querySelector('img, video, canvas')
            ) {
                answerHtml += childElement.outerHTML + '\n';
            }
        }
        console.log('LOG: Extracted HTML from answerContainer children. Count:', answerContainer.children.length);
    } else if (answerContainer.textContent && answerContainer.textContent.trim() !== '') {
        answerHtml = answerContainer.innerHTML;
        console.log('LOG: answerContainer has no children, using its innerHTML.');
    }

    if (!answerHtml.trim()) {
      console.log('LOG: Extracted answerHtml is empty. answerContainer HTML preview:', answerContainer.innerHTML.substring(0, 500));
      // 如果这里为空，但网页能复制txt，说明网页的复制功能可能不是直接从这部分DOM来的
      // 或者是我们的htmlToMarkdown处理后变空了
      // 尝试用 event.clipboardData (如果浏览器支持且是 copy 事件)
      // 但这里是 click 事件，所以得依赖 navigator.clipboard
      // navigator.clipboard.readText().then(clipText => {
      //    console.log("Clipboard text from browser's default copy:", clipText);
      //    // 你可以尝试用这个 clipText，但它已经是纯文本了
      // }).catch(err => {
      //    console.log("Failed to read clipboard from browser's default copy:", err);
      // });
      // 对于点击事件，我们不能直接获取默认复制的内容，只能阻止它然后自己复制
      // 如果 answerHtml 为空，并且你想回退到复制纯文本，可以这样做：
      const rawText = answerContainer.innerText || answerContainer.textContent || "";
      if (rawText.trim()){
        navigator.clipboard.writeText(rawText.trim()).then(() => {
            console.log('LOG: Copied raw text because extracted HTML for markdown was empty.');
        }).catch(err => {
            console.error('LOG: Failed to copy raw text:', err);
        });
      }
      return; // 既然 answerHtml 是空的，后面转 markdown 也没意义
    }
    // console.log('LOG: Extracted HTML for markdown conversion:', answerHtml.substring(0, 500) + '...');

    const markdownContent = htmlToMarkdown(answerHtml);
    if (!markdownContent.trim()) {
        console.warn('LOG: Markdown conversion resulted in empty string. Original HTML preview:', answerHtml.substring(0, 500) + '...');
        const rawText = answerContainer.innerText || answerContainer.textContent || "";
        navigator.clipboard.writeText(rawText.trim()).then(() => {
            console.log('LOG: Copied raw text instead of empty markdown.');
        }).catch(err => {
            console.error('LOG: Failed to copy raw text:', err);
        });
        return;
    }

    navigator.clipboard.writeText(markdownContent).then(() => {
      console.log('LOG: Successfully copied Markdown to clipboard. Preview:', markdownContent.substring(0, 200) + "...");
    }).catch(err => {
      console.error('LOG: Failed to copy Markdown to clipboard:', err);
    });

    event.preventDefault(); // 阻止浏览器默认的复制行为
    event.stopPropagation(); // 阻止事件冒泡
  }

  document.addEventListener('click', copyAsMarkdown, { capture: true });
  console.log('LOG: Markdown Copy Helper extension loaded and listening.');
})();

