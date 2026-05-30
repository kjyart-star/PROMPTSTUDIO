-- Supabase Realtime 기능을 announcements 테이블에 활성화하는 스크립트
-- JS 클라이언트에서 .on('postgres_changes', ...) 를 수신하기 위해 반드시 필요합니다.

begin;
  -- 만약 publication이 없다면 먼저 생성 (Supabase에는 보통 기본적으로 존재함)
  -- create publication supabase_realtime;
  
  -- announcements 테이블을 supabase_realtime publication에 추가
  alter publication supabase_realtime add table announcements;
commit;
