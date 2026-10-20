#!/usr/bin/env python3
"""Build the final shared curriculum, reader, daily PDFs and collection."""
import build_workbooks as publication
import finalize_course
finalize_course.install(publication)
_prepare=publication.prepare
_document=publication.doc

def final_lessons():
    lessons=_prepare()
    lessons[9]['sample']=lessons[9]['sample'].replace('最初十一人回复：九人满意，两人一般，一人尚未回复。','最初十一人回复，其中九人满意、两人一般；另有一人尚未回复。')
    lessons[8]['sample']=lessons[8]['sample'].replace('同时记录准备负担、会议时间','同时记录会议时间')
    return lessons

def final_document(body,title):
    return _document(body,title).replace('2026年10月修订','定稿版 · 2026.10.20-final')

publication.prepare=final_lessons
publication.doc=final_document
if __name__=='__main__':
    publication.main()
