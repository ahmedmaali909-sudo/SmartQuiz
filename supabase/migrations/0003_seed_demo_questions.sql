-- =============================================================================
-- SmartQuiz — 0003_seed_demo_questions.sql
-- DEMO CONTENT ONLY: 15 French questions to exercise the game engine before the
-- AI generation phase. Delete them with:
--   delete from public.questions where category_id = 'culture-generale' and source = 'manual';
-- =============================================================================

with data(prompt, correct, w1, w2, w3, explanation, is_boss) as (
  values
    ('Quelle est la capitale de l''Australie ?', 'Canberra', 'Sydney', 'Melbourne', 'Perth', 'Sydney est la plus grande ville, mais Canberra est la capitale fédérale.', false),
    ('Combien de continents compte la Terre ?', '7', '5', '6', '8', 'Afrique, Amérique du Nord, Amérique du Sud, Antarctique, Asie, Europe, Océanie.', false),
    ('Quel est le plus long fleuve du monde ?', 'Le Nil', 'L''Amazone', 'Le Danube', 'Le Mississippi', 'Le Nil est généralement cité en premier, suivi de près par l''Amazone.', false),
    ('Qui a peint la Joconde ?', 'Léonard de Vinci', 'Michel-Ange', 'Raphaël', 'Botticelli', 'La Joconde est exposée au Louvre, à Paris.', false),
    ('Quel est le symbole chimique de l''or ?', 'Au', 'Ag', 'Or', 'Go', 'Au vient du latin aurum.', false),
    ('En quelle année l''homme a-t-il marché sur la Lune ?', '1969', '1959', '1972', '1965', 'Mission Apollo 11, le 20 juillet 1969.', false),
    ('Combien de joueurs composent une équipe de football sur le terrain ?', '11', '10', '12', '9', 'Dix joueurs de champ et un gardien.', false),
    ('Quelle planète est la plus proche du Soleil ?', 'Mercure', 'Vénus', 'Mars', 'La Terre', 'Mercure boucle son orbite en 88 jours.', false),
    ('Quel océan est le plus vaste ?', 'L''océan Pacifique', 'L''océan Atlantique', 'L''océan Indien', 'L''océan Arctique', 'Le Pacifique couvre environ un tiers de la surface du globe.', false),
    ('Combien de côtés a un hexagone ?', '6', '5', '7', '8', 'Du grec hexa, « six ».', false),
    ('Qui a écrit « Les Misérables » ?', 'Victor Hugo', 'Émile Zola', 'Gustave Flaubert', 'Honoré de Balzac', 'Publié en 1862.', false),
    ('Quel est le plus grand désert chaud du monde ?', 'Le Sahara', 'Le Gobi', 'Le Kalahari', 'L''Atacama', 'Le Sahara s''étend sur environ 9 millions de km².', false),
    ('Quelle est la langue la plus parlée au monde par nombre de locuteurs natifs ?', 'Le mandarin', 'L''anglais', 'L''espagnol', 'L''hindi', 'Plus de 900 millions de locuteurs natifs.', true),
    ('Quel organe produit l''insuline ?', 'Le pancréas', 'Le foie', 'Les reins', 'La thyroïde', 'Les îlots de Langerhans du pancréas la sécrètent.', true),
    ('Quelle est l''unité de mesure de la puissance électrique ?', 'Le watt', 'Le volt', 'L''ampère', 'L''ohm', 'Le watt (W) mesure la puissance, le volt la tension.', true)
),
inserted as (
  insert into public.questions (category_id, locale, prompt, explanation, difficulty, is_boss, source)
  select 'culture-generale', 'fr', d.prompt, d.explanation, 2, d.is_boss, 'manual'
  from data d
  where not exists (
    select 1 from public.questions q
    where q.category_id = 'culture-generale' and q.locale = 'fr' and q.prompt = d.prompt
  )
  returning id, prompt
)
insert into public.question_options (question_id, label, is_correct, position)
select
  i.id,
  o.label,
  o.is_correct,
  ((o.position + char_length(d.prompt)) % 4)::smallint
from inserted i
join data d on d.prompt = i.prompt
cross join lateral (
  values
    (d.correct, true, 0),
    (d.w1, false, 1),
    (d.w2, false, 2),
    (d.w3, false, 3)
) as o(label, is_correct, position);
