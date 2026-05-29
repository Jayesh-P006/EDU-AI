import Editor from '@monaco-editor/react';

function CodeEditor({code, language, onChange})
{
    const languageMap={
        javascript: 'javascript',
        python: 'python',
        java: 'java',
        cpp: 'cpp',
        c: 'c',
    };

    const handleChange=(value) =>
    {
        // Guard: only call onChange if the function is provided
        if (onChange) onChange(value||'');
    };

    return (
        <div style={{flex: 1, minHeight: 0, overflow: 'hidden'}}>
            <Editor
                height="100%"
                language={languageMap[language]||'javascript'}
                value={code}
                onChange={handleChange}
                theme="vs-dark"
                loading={<div style={{padding: '20px', color: '#a3a3a3', textAlign: 'center'}}>Loading editor...</div>}
                options={{
                    minimap: {enabled: false},
                    fontSize: 14,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    tabSize: 2,
                }}
            />
        </div>
    );
}

export default CodeEditor;
