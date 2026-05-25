--
-- PostgreSQL database dump
--

\restrict Qf3wlfeArRejkmZpbdzs20wMNOSotrfAVujZjTfho3mpnXM0AcE1fQTEaM5yRLS

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: vpn_user
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO vpn_user;

--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: EXTENSION citext; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION citext IS 'data type for case-insensitive character strings';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admin_settings; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.admin_settings (
    id uuid NOT NULL,
    password_min_length integer NOT NULL,
    password_require_upper boolean NOT NULL,
    password_require_lower boolean NOT NULL,
    password_require_digit boolean NOT NULL,
    lockout_max_attempts integer NOT NULL,
    lockout_minutes integer NOT NULL,
    min_topup_amount bigint NOT NULL,
    session_timeout_hours integer NOT NULL,
    snapshot_retention_count integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.admin_settings OWNER TO vpn_user;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text,
    target text,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: credentials; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.credentials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.credentials OWNER TO postgres;

--
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.email_verifications (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.email_verifications OWNER TO vpn_user;

--
-- Name: identities; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.identities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text NOT NULL,
    subject text NOT NULL,
    access_token_enc bytea,
    refresh_token_enc bytea,
    expires_at timestamp with time zone,
    last_login_at timestamp with time zone
);


ALTER TABLE public.identities OWNER TO postgres;

--
-- Name: login_challenges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.login_challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash bytea NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    user_agent text,
    ip inet
);


ALTER TABLE public.login_challenges OWNER TO postgres;

--
-- Name: machine_logs; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.machine_logs (
    id uuid NOT NULL,
    machine_id uuid NOT NULL,
    session_id uuid,
    level character varying NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.machine_logs OWNER TO vpn_user;

--
-- Name: machines; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.machines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    region text,
    ping_ms integer,
    gpu text,
    status text DEFAULT 'idle'::text NOT NULL,
    last_heartbeat timestamp with time zone,
    location text
);


ALTER TABLE public.machines OWNER TO postgres;

--
-- Name: maintenance_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.maintenance_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    machine_id uuid NOT NULL,
    action text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.maintenance_logs OWNER TO postgres;

--
-- Name: password_resets; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.password_resets (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    consumed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.password_resets OWNER TO vpn_user;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.payments (
    id uuid NOT NULL,
    user_id uuid,
    order_id character varying NOT NULL,
    request_id character varying NOT NULL,
    amount integer NOT NULL,
    currency character varying NOT NULL,
    provider character varying NOT NULL,
    status character varying NOT NULL,
    message character varying,
    pay_url character varying,
    trans_id character varying,
    extra_data character varying,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone,
    subscription_id uuid
);


ALTER TABLE public.payments OWNER TO vpn_user;

--
-- Name: player_profiles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.player_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    phone_enc bytea,
    dob_enc bytea,
    note_enc bytea
);


ALTER TABLE public.player_profiles OWNER TO postgres;

--
-- Name: revoked_tokens; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.revoked_tokens (
    id uuid NOT NULL,
    token_hash character varying NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.revoked_tokens OWNER TO vpn_user;

--
-- Name: service_plans; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.service_plans (
    id uuid NOT NULL,
    code character varying NOT NULL,
    name character varying NOT NULL,
    description text,
    price_cents integer NOT NULL,
    currency character varying NOT NULL,
    duration_days integer NOT NULL,
    data_limit_gb integer,
    active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.service_plans OWNER TO vpn_user;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    machine_id uuid NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    duration_sec integer,
    cost numeric(12,2)
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.subscriptions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    status character varying NOT NULL,
    start_at timestamp with time zone DEFAULT now() NOT NULL,
    end_at timestamp with time zone,
    auto_renew boolean NOT NULL,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.subscriptions OWNER TO vpn_user;

--
-- Name: topup_transactions; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.topup_transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    payment_id uuid,
    amount bigint NOT NULL,
    balance_before bigint NOT NULL,
    balance_after bigint NOT NULL,
    status character varying NOT NULL,
    provider character varying NOT NULL,
    description character varying,
    trans_id character varying,
    created_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone
);


ALTER TABLE public.topup_transactions OWNER TO vpn_user;

--
-- Name: COLUMN topup_transactions.balance_before; Type: COMMENT; Schema: public; Owner: vpn_user
--

COMMENT ON COLUMN public.topup_transactions.balance_before IS 'Sá»‘ dÆ° trÆ°á»›c khi náº¡p';


--
-- Name: COLUMN topup_transactions.balance_after; Type: COMMENT; Schema: public; Owner: vpn_user
--

COMMENT ON COLUMN public.topup_transactions.balance_after IS 'Sá»‘ dÆ° sau khi náº¡p';


--
-- Name: COLUMN topup_transactions.status; Type: COMMENT; Schema: public; Owner: vpn_user
--

COMMENT ON COLUMN public.topup_transactions.status IS 'Tráº¡ng thÃ¡i: pending, succeeded, failed';


--
-- Name: topups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.topups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'VND'::text NOT NULL,
    provider text,
    provider_txn_id text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.topups OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email public.citext NOT NULL,
    display_name text,
    role text DEFAULT 'user'::text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    balance bigint DEFAULT 0 NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vpn_sessions; Type: TABLE; Schema: public; Owner: vpn_user
--

CREATE TABLE public.vpn_sessions (
    id uuid NOT NULL,
    user_id uuid,
    subscription_id uuid,
    machine_id uuid,
    status character varying NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    ip_address character varying,
    bytes_up bigint NOT NULL,
    bytes_down bigint NOT NULL
);


ALTER TABLE public.vpn_sessions OWNER TO vpn_user;

--
-- Data for Name: admin_settings; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.admin_settings (id, password_min_length, password_require_upper, password_require_lower, password_require_digit, lockout_max_attempts, lockout_minutes, min_topup_amount, session_timeout_hours, snapshot_retention_count, created_at, updated_at) FROM stdin;
a6cb060b-26ad-4144-8ca5-b3a125009651	8	t	t	t	5	10	10000	24	1	2026-04-17 16:24:14.671331+07	2026-04-17 16:24:14.671331+07
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, actor_id, action, target, meta, created_at) FROM stdin;
\.


--
-- Data for Name: credentials; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.credentials (id, user_id, password_hash, created_at) FROM stdin;
bfe34468-e4d3-42eb-8ab5-3e76a6ca8b02	7fc5ad7e-9e38-4213-93ae-67a94117503a	$2b$12$xXfyA9VKbTqgsNmOaT0/yeTg6cTv71GoJIWL15/K9xROxJtavhqDe	2026-01-16 11:56:34.957125+07
0f1f7c28-f7d9-4207-b338-ac44d659d0ed	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	$2b$12$YoJRUD9m6UBY3p4d1ZKJxO17mTtUWQB6lcCExenW.AfRNZWLQ9Cci	2026-01-20 01:38:19.434527+07
2351d21f-4b5d-4e88-a4db-b04b9267bfa7	4e1c6b37-63d8-4548-95c8-e643d3649860	$2b$12$bf/4TY9gQvhU9vhnJxlFDO4hzK.VYNBI/UJ1exuwdhgZCQ59yRqN6	2026-01-16 02:06:58.140403+07
33798e0e-322c-4d41-a6f1-02402e9b810d	cda88030-7404-465f-b79d-60a2f072e654	$2b$12$sscwwczUjwJSQVjbD7DKROb0DPg//ZFMAV7OqzQydDTPrlgFb4U9u	2026-02-04 12:06:33.598387+07
090743f5-c351-4da9-8bc6-2b3701df43c6	5ad249ec-87a9-4f66-adc3-e414762f7515	$2b$12$sUye63aFHJVWTbNCmlXB1OPw858kMZQ1L7Lu0bgsj2c7xoAL/jdn.	2026-02-09 10:24:09.874382+07
482cf955-0151-4234-9d72-b41695aee0a8	0d85f023-3718-4bb7-b41a-5dc122899e37	$2b$12$Zf9zQDaWwNVmLaW285f/CezeEhUqSLWYA47YpEYVBhGNzz7XmeEgy	2026-01-16 11:58:08.868825+07
fe4e9ad3-5570-43f5-92bf-865861fba6ba	6e114b1c-5bc4-4967-8c0f-7a2fc2079151	$2b$12$IovPTHzuLVcB5pGmDUk2NOXc03Fynibf9AFQLCAi9nd2OZpSu6bnu	2026-02-26 16:49:33.181563+07
\.


--
-- Data for Name: email_verifications; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.email_verifications (id, user_id, token_hash, expires_at, consumed_at, created_at) FROM stdin;
4743085b-8561-4608-8ad2-67d844a5ea52	cda88030-7404-465f-b79d-60a2f072e654	7063906c17d7ab6e16efc396fd89409e2d38bfb807853cd73964178e4f592e1e	2026-02-04 05:36:33.89603+07	\N	2026-02-04 12:06:33.598387+07
\.


--
-- Data for Name: identities; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.identities (id, user_id, provider, subject, access_token_enc, refresh_token_enc, expires_at, last_login_at) FROM stdin;
4caae61e-918f-4997-a634-a043bcded2c3	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	google	111676928192369256707	\\x796132392e613041554d57675f4c53767570436f5f37635f616b366b4b70475f43776754584e567579364378346f6c4b466f635a536a4661383738374636744d514a374c374c7a6d4f4e4c72554b62415f695949616432655346706e47696d694b77364f454d56555a33455156467864633838547a5a593954676b7072744d4e4545487a4773485542716278306634354e706577392d6b67565759755f367538386e357069617272387935585272374d4f7a766e746f6b52367237326377595a2d414a434c3349615f325675576f614367594b41545153415259534651484758324d69724b2d314e6b6f347a794f614b5a716772425f736a4130323036	\\x312f2f3065555054656636786b44446f4367594941524141474134534e77462d4c3949726d4a2d4132376a58536233646e536e63716b55324c756778613653734a6f697678306a3146456843623545466837564b4f69743436504b416a35434e364d466b307241	2026-01-16 07:43:54.384153+07	2026-01-16 06:43:55.384153+07
d19a80ee-2ac0-480f-81d4-8feddacabb5a	0d85f023-3718-4bb7-b41a-5dc122899e37	google	108150059099779053682	\\x796132392e613041554d57675f495f4b42722d574879794f7a3176517966767a57346e756d5468546e4f75385133344a566b3155474b52357064507152706d576f484d6b5251462d7968536c49716763683158445a71304639453263754e7661663679756571745f48506a6b6273434936476b3275776d5764567956456d72666d6e68675764454a46615565614b334e7a5575414f5637465a57757857477630544f396e626d365666415f746841743553324e7353395265396f6b464d6e4e6c312d337648686275535341385863614367594b41637753415251534651484758324d697554754c636d5a427439564f4e6a6d5654735567796730323036	\\x312f2f3065396830554f66646466624a4367594941524141474134534e77462d4c39497253347847335a52366734516a4775482d6131305838747150666e6a52305651305a71585857772d464c5565387073566a2d3446617675516c6430437443466e2d4d4d30	2026-01-16 07:29:59.476691+07	2026-04-14 11:46:43.552953+07
\.


--
-- Data for Name: login_challenges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.login_challenges (id, user_id, token_hash, expires_at, consumed_at, user_agent, ip) FROM stdin;
\.


--
-- Data for Name: machine_logs; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.machine_logs (id, machine_id, session_id, level, message, created_at) FROM stdin;
\.


--
-- Data for Name: machines; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.machines (id, code, region, ping_ms, gpu, status, last_heartbeat, location) FROM stdin;
ac34725e-bd26-47c0-95f7-7c470f640c43	US-01	San Jose	160	T4	idle	2026-01-16 02:07:11.709659+07	US DC1
95f102cf-3517-4091-8a10-343e93aeb362	US-02	San Jose	165	T4	idle	2026-01-16 02:07:11.709659+07	US DC1
e93ca82a-90ee-4f5f-a1a5-31e8f60ed66f	US-03	San Jose	170	T4	idle	2026-01-16 02:07:11.709659+07	US DC1
ef8b3bed-3420-42c9-983d-3931cdb558df	US-04	San Jose	175	T4	idle	2026-01-16 02:07:11.709659+07	US DC1
bb9dce5a-b675-409d-aad0-c7d05b914255	KR-02	Seoul	58	RTX 3080	idle	2026-01-16 02:07:11.709659+07	KR DC1
2de47532-de33-40d9-a057-2fbc31aa254a	AU-01	Sydney	90	T4	idle	2026-01-16 02:07:11.709659+07	AU DC1
162625bb-34a0-441e-87b6-52edd582842d	AU-02	Sydney	95	T4	idle	2026-01-16 02:07:11.709659+07	AU DC1
6390e116-fbe5-44e7-b6f3-1d51cdd29d35	HK-01	Hong Kong	38	RTX 3080	idle	2026-01-16 02:07:11.709659+07	HK DC1
05f36e68-af70-4cfe-9ecf-00ad8c3997e4	HK-02	Hong Kong	40	RTX 3080	idle	2026-01-16 02:07:11.709659+07	HK DC1
484f84b9-616c-4d35-b64e-67f1f037c7c9	KR-01	Seoul	55	RTX 3080	idle	2026-01-16 02:07:11.709659+07	KR DC1
579eee31-ef73-4ed2-9fbd-dafd93b467c8	SG-01	Singapore	28	RTX 4080	idle	2026-01-16 02:07:11.709659+07	SG DC1
1a390bb0-1aa9-490c-8ef3-ba17476d0bff	SG-02	Singapore	30	RTX 4080	idle	2026-01-16 02:07:11.709659+07	SG DC1
de5c10a4-cb5c-4b09-ba3d-565b06c1afbf	SG-03	Singapore	32	RTX 3080	idle	2026-01-16 02:07:11.709659+07	SG DC1
c54a5db7-4ba0-4968-a847-b1756a505dc5	SG-04	Singapore	35	RTX 3080	idle	2026-01-16 02:07:11.709659+07	SG DC1
855ad23c-ac18-4fd6-b7c2-6b647758b966	JP-01	Tokyo	45	RTX 3080	idle	2026-01-16 02:07:11.709659+07	JP DC1
a81f2e86-c94e-4e2e-88d4-c21e8658fd77	JP-02	Tokyo	48	RTX 3080	idle	2026-01-16 02:07:11.709659+07	JP DC1
8e407806-7822-4fe5-8ad2-792e492b0705	JP-03	Tokyo	50	T4	idle	2026-01-16 02:07:11.709659+07	JP DC1
61d0adf0-7c9e-4937-b923-54e051c6884b	JP-04	Tokyo	52	T4	idle	2026-01-16 02:07:11.709659+07	JP DC1
eee0bce7-855e-4a88-869c-069472e56abb	VN-01	Hanoi	20	RTX 3070	idle	2026-01-16 02:07:11.709659+07	VN DC1
23c91c19-fe1e-47ed-9a43-8c6fdcb833f3	VN-02	HCMC	22	RTX 3070	idle	2026-01-16 02:07:11.709659+07	VN DC2
\.


--
-- Data for Name: maintenance_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.maintenance_logs (id, machine_id, action, note, created_at) FROM stdin;
\.


--
-- Data for Name: password_resets; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.password_resets (id, user_id, token_hash, expires_at, consumed_at, created_at) FROM stdin;
738c667e-2228-4dd5-9263-ca43ce19e56f	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	5b4f196d2db28bfad90e20b3c0e7286611f10dac2c4a0ef7a5c63ecd83b0b233	2026-01-19 18:58:14.069157+07	\N	2026-01-20 01:28:14.045989+07
906afcdd-9933-4662-85c2-5a9c872ab6a4	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	9214720c79081f2ed3adfe626c585ec9b237af6fa066fb31bddad17000e5c351	2026-01-19 19:01:18.106269+07	\N	2026-01-20 01:31:18.081339+07
289dacf6-76f3-4330-aace-6e99b5e33d47	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	64054cd62113ee5863ac480c493930f55eaa3fa439453e3fe4984e5096b67c20	2026-01-19 19:02:04.779311+07	2026-01-19 18:38:20.010419+07	2026-01-20 01:32:04.778484+07
a1554d06-7da6-4fad-915c-dab3a70ac9fd	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	e55b642a6a24a3409868f0332af3bb124ad15a46d17a8a7c9ced4fb95086a800	2026-01-19 19:09:13.304672+07	2026-01-19 18:40:05.655689+07	2026-01-20 01:39:13.30325+07
ce25bf2b-8ddd-40bf-9ee4-bf0f908fdcdc	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	e9c8e3e540f40cd54748a9c7c3aadddc39cd67b3c86d4bad3221a02cfedeba39	2026-02-09 04:06:44.309094+07	\N	2026-02-09 10:36:44.284913+07
d338fcf9-af77-4209-bd5b-e3ca66d29f5b	0d85f023-3718-4bb7-b41a-5dc122899e37	49abcd0ea3ac6ffe09e0251d9a45699a3f0697db33721efab4c7bf7df1c764c5	2026-01-19 18:19:24.135588+07	\N	2026-01-20 00:49:24.133487+07
69c0f195-5662-4ad4-8384-1a781fa72a0d	1a81b9b9-3aca-46e4-b38f-3c383cc6b964	036d6123999539046a146b5706330562b022d3e6bc31a406510e1d99f5db0d92	2026-01-19 18:46:26.864672+07	\N	2026-01-20 01:16:26.769796+07
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.payments (id, user_id, order_id, request_id, amount, currency, provider, status, message, pay_url, trans_id, extra_data, created_at, updated_at, subscription_id) FROM stdin;
630ab9b4-073c-446b-8d95-73ca095e16cd	\N	14963882d0817b51c4ab	1c124b73191242018204	57000	VND	momo	pending	Thành công.	https://test-payment.momo.vn/v2/gateway/pay?t=TU9NT3wxNDk2Mzg4MmQwODE3YjUxYzRhYg&s=d1d117b5c9f667a0b9ca89b9bdabe01d9869d7d16f10782a37defcae008d024d	\N		2026-01-21 03:49:10.055151+07	\N	\N
f5e263cb-7148-4140-b65d-87ba3bcc9b2c	\N	5e2e79a52de07e65fc0f	86c3073fcc46ac92efff	55000	VND	momo	pending	Thành công.	https://test-payment.momo.vn/v2/gateway/pay?t=TU9NT3w1ZTJlNzlhNTJkZTA3ZTY1ZmMwZg&s=09104e88c3018ebf0749027f499c5b3da1af03f290fa11988ec808a145445f94	\N		2026-01-21 14:38:25.662089+07	\N	\N
f0ac4da0-055e-4a89-8213-16891edc7e89	0d85f023-3718-4bb7-b41a-5dc122899e37	37b293bcc75741f9e7af	55fd31ba8483575ec0a2	50000	VND	momo	pending	Thành công.	https://test-payment.momo.vn/v2/gateway/pay?t=TU9NT3wzN2IyOTNiY2M3NTc0MWY5ZTdhZg&s=4794380baadb61aa7a18fd9f9b4819b0ce4c1f61a8ca76032d35cf9468f42576	\N		2026-01-23 14:34:36.909684+07	\N	\N
a08640cc-5c7c-4652-b212-47390180a32c	0d85f023-3718-4bb7-b41a-5dc122899e37	9d724edbc310ed0b2257	dc318a147d1856952a8d	500000	VND	momo	pending	Thành công.	https://test-payment.momo.vn/v2/gateway/pay?t=TU9NT3w5ZDcyNGVkYmMzMTBlZDBiMjI1Nw&s=81e91eddbe098d6b5bc4505ef0d19d584da6c557325b0df4606ee310a4d0d0c4	\N		2026-01-23 14:40:09.449895+07	\N	\N
632c56a2-d2f2-464f-b713-9f5c04114fdf	0d85f023-3718-4bb7-b41a-5dc122899e37	ca37c7beb150b074c47c	56efeccbd05750002e3a	50000	VND	momo	pending	Thành công.	https://test-payment.momo.vn/v2/gateway/pay?t=TU9NT3xjYTM3YzdiZWIxNTBiMDc0YzQ3Yw&s=8885ce34270acc5071a7f2fa59b46afcf5742cf1f24d988ba5d473d10f126c5c	\N		2026-02-04 12:04:05.997721+07	\N	\N
7717e166-1b98-423c-b9ed-782eea44eeb1	0d85f023-3718-4bb7-b41a-5dc122899e37	84213ef2ee4b0677ccc2	5b54dcde5d5a8e2f0b80	10000	VND	momo	pending	Thành công.	https://test-payment.momo.vn/v2/gateway/pay?t=TU9NT3w4NDIxM2VmMmVlNGIwNjc3Y2NjMg&s=d28b4870313e04f6e758ce95e0ad468f5e0cb6d0406f7351fe1609c31d3559d1	\N		2026-04-14 16:06:02.325761+07	\N	\N
\.


--
-- Data for Name: player_profiles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.player_profiles (id, user_id, phone_enc, dob_enc, note_enc) FROM stdin;
\.


--
-- Data for Name: revoked_tokens; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.revoked_tokens (id, token_hash, expires_at, created_at) FROM stdin;
e2b7becb-946c-4fd9-91c5-6723098ccddb	6d1ef033b93801a3d16c5aceb4d48bcfc2d0781983f6b0d59301b74a4172f62b	2026-01-20 10:52:43+07	2026-01-20 17:23:21.787727+07
ff3dbbb6-369e-4d82-9585-130a05860b99	e37b2e9765b323c72fe037c19e2a9f56b608ea3bba0586cbf770515f4145e4c0	2026-01-20 10:53:32+07	2026-01-20 17:23:52.324801+07
0d1b4062-64ec-4bda-a6ef-5d409a158ecc	bb53ee2d81826f86726b3a77ae5f67fb35d0f18fdbec11cb400da6c601ea8854	2026-01-20 10:54:28+07	2026-01-20 17:24:55.061388+07
457f808d-ded1-4fbe-b22c-49016bf888fa	92eab7e64cbb9c718a8cb96ba92f5a6ec6af5ad016c89147cb1766dbdf5c4e09	2026-01-20 10:55:01+07	2026-01-20 17:25:03.36634+07
0ce41d97-edb7-40ff-a2b1-89becd1ed720	6ffcb88889d95a46138b970aeafb1bd970044ffd9fc1efb6fb5c5f46d58e9d27	2026-01-20 10:55:51+07	2026-01-20 17:26:00.799477+07
a62304d2-ab9c-4ec1-a894-85e1a510ede7	ce73427aef3ab63b808cb385a68a6cc8e81c145765d1eef2f3e24bed7875b7cc	2026-01-20 13:09:11+07	2026-01-20 19:39:38.524109+07
902026ee-8ddf-4928-b376-2679dd5f170c	cb388d1dca7e1de52b93b206a37aa200235122b8aceb0c6498a41f2092890a3b	2026-01-20 15:24:20+07	2026-01-20 21:55:35.809859+07
4e91f3f8-0a6b-4dd9-b8fd-08582cb1e372	430bfcfb11efa5e1d299421633270f2b570219406c38523436a1fdd182230bac	2026-01-20 20:29:57+07	2026-01-21 03:02:34.108266+07
51b1d304-1c33-4366-888f-e36620ea27ea	00b425cb757769fcbb29f7de681740e951d180abeada60d7bf202e7a09c10ee2	2026-01-20 20:32:52+07	2026-01-21 03:03:19.657466+07
3e785640-ceda-4ce0-aceb-bf11e077a882	b03a2d8ae73a9555582108a6f274b1319fe8226c5a508b1c0c915b7bac86255e	2026-01-23 09:34:40+07	2026-01-23 16:05:49.851536+07
0b5f03b9-5e29-4f92-a21a-c806a4e5da2e	38eb9bc55d852d1305b167f0b870db27cefac79041cf207f411be715d86f6375	2026-02-04 05:10:57+07	2026-02-04 11:43:31.700878+07
3720551e-0d30-458b-81ab-e82e69135ce4	f08e3f7b2c48ccaad2133d93a4c772373bc387eca61423a214210f6cca8a5b13	2026-02-04 05:13:49+07	2026-02-04 11:45:54.211615+07
71150446-c8c2-4f59-a671-5651a22bb8e0	d939f851d53d141d27b3399a9aeee7cda04c719b92b76e711e9e461e81e28893	2026-02-04 05:16:05+07	2026-02-04 11:46:13.08918+07
578a50ca-a867-4a1b-9a7e-51ae51ef7f0d	030b5544b3c245ae90a1c1afdd995f534cf79c99ce2fa0bccd9a8d0a7d50528f	2026-02-04 05:30:55+07	2026-02-04 12:07:47.695901+07
972092ea-be6d-4b65-82ca-f348fda5adfa	b615762016bf8b3731a8c1a2abd2455783719f5bd6559abd39778466f210c570	2026-02-09 04:04:20+07	2026-02-09 10:34:34.083532+07
30737821-b441-4fec-8d31-c82f913b828b	dbcfb2052396532ced24a6a07ed12797d224bcb864e987c1e4d261a68e1f9514	2026-02-26 10:17:12+07	2026-02-26 16:47:22.644594+07
731a666f-b5e6-489f-ba61-07f3483187e9	fe016fc7d32aaddee0b7dbd686fc4b2f32ba6bb336f0e96e3e78e46429e18838	2026-04-14 09:33:05+07	2026-04-14 16:05:28.069334+07
49e9ae9a-74ad-4f59-905f-f8d170129a74	d27bd1ea5b6dfa8724d057e5dfcfbe2c28a5d7952433aad510330bb3feb5603f	2026-04-17 09:53:27+07	2026-04-17 16:24:11.642046+07
85e9c94d-844d-4683-a772-edb99942edf2	9e285360ba6b1f1db2a6c7cc323d60753c941f21e03832b33682bc673b118b01	2026-04-17 09:54:14+07	2026-04-17 16:27:12.911615+07
4a2859ec-8a3e-49d1-b630-5b98940f7bc1	eaf419775c3e7ed225b7ae19ed70e3916303c58286e88f455c687188086393a2	2026-04-17 09:57:23+07	2026-04-17 16:36:54.462002+07
\.


--
-- Data for Name: service_plans; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.service_plans (id, code, name, description, price_cents, currency, duration_days, data_limit_gb, active, created_at) FROM stdin;
fca083dd-bcf1-42e2-a9c3-7a28ac2e556d	basic	Gói Cơ Bản	Phù hợp cho người dùng cá nhân	50000	VND	30	50	t	2026-02-09 10:24:09.836758+07
639655f3-9825-40fd-9664-62f1415163a7	pro	Gói Pro	Dành cho game thủ chuyên nghiệp	100000	VND	30	100	t	2026-02-09 10:24:09.836758+07
1ca8ddfc-985e-4a52-9684-a27690c5c0df	premium	Gói Premium	Không giới hạn dung lượng	200000	VND	30	\N	t	2026-02-09 10:24:09.836758+07
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (id, user_id, machine_id, start_at, end_at, duration_sec, cost) FROM stdin;
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.subscriptions (id, user_id, plan_id, status, start_at, end_at, auto_renew, canceled_at, created_at) FROM stdin;
\.


--
-- Data for Name: topup_transactions; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.topup_transactions (id, user_id, payment_id, amount, balance_before, balance_after, status, provider, description, trans_id, created_at, completed_at) FROM stdin;
938eb06f-9e4f-4960-a356-27f2afec1361	0d85f023-3718-4bb7-b41a-5dc122899e37	f0ac4da0-055e-4a89-8213-16891edc7e89	50000	0	0	pending	momo		\N	2026-01-23 14:34:36.909684+07	\N
310ad289-0640-4356-88c6-b4a602569ea8	0d85f023-3718-4bb7-b41a-5dc122899e37	a08640cc-5c7c-4652-b212-47390180a32c	500000	0	0	pending	momo		\N	2026-01-23 14:40:09.449895+07	\N
5cbe1262-b7d4-4b47-b759-aab5da03da84	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	100000	0	100000	succeeded	admin	Admin test topup	\N	2026-02-04 11:53:36.284729+07	2026-02-04 04:53:36.314942+07
6118379b-fc74-414e-9a83-5aae9571534f	0d85f023-3718-4bb7-b41a-5dc122899e37	632c56a2-d2f2-464f-b713-9f5c04114fdf	50000	100000	100000	pending	momo	\N	\N	2026-02-04 12:04:05.997721+07	\N
e4dce575-2ea2-48af-97da-41a04b503aeb	0d85f023-3718-4bb7-b41a-5dc122899e37	7717e166-1b98-423c-b9ed-782eea44eeb1	10000	100000	100000	pending	momo		\N	2026-04-14 16:06:02.325761+07	\N
\.


--
-- Data for Name: topups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.topups (id, user_id, amount, currency, provider, provider_txn_id, status, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, display_name, role, status, created_at, balance) FROM stdin;
1a81b9b9-3aca-46e4-b38f-3c383cc6b964	bacnicepro@gmail.com	03_Nguyễn Văn Bắc	user	active	2026-01-16 13:43:55.363186+07	0
0d85f023-3718-4bb7-b41a-5dc122899e37	bacnguyen2921@gmail.com	Updated Name	user	active	2026-01-16 11:58:08.868825+07	100000
5ad249ec-87a9-4f66-adc3-e414762f7515	admin@vpngaming.com	Administrator	admin	active	2026-02-09 10:24:09.874382+07	0
4e1c6b37-63d8-4548-95c8-e643d3649860	admin@example.com	Admin	user	active	2026-01-16 02:06:49.22691+07	0
7fc5ad7e-9e38-4213-93ae-67a94117503a	testuser@example.com	Test	user	active	2026-01-16 11:56:34.957125+07	0
6e114b1c-5bc4-4967-8c0f-7a2fc2079151	admin@cloudgaming.vn	Administrator	admin	active	2026-02-26 16:49:33.181563+07	0
cda88030-7404-465f-b79d-60a2f072e654	newuser_test@example.com	New Test User	user	active	2026-02-04 12:06:33.598387+07	0
\.


--
-- Data for Name: vpn_sessions; Type: TABLE DATA; Schema: public; Owner: vpn_user
--

COPY public.vpn_sessions (id, user_id, subscription_id, machine_id, status, started_at, ended_at, ip_address, bytes_up, bytes_down) FROM stdin;
f62327ae-a20d-4a0a-ab75-8dee0a6fb6da	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	eee0bce7-855e-4a88-869c-069472e56abb	active	2026-01-21 14:07:46.514206+07	\N	\N	0	0
a950af81-1e53-4e6c-94ed-f22e4630cae8	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	23c91c19-fe1e-47ed-9a43-8c6fdcb833f3	active	2026-01-21 14:07:47.502735+07	\N	\N	0	0
80d9429f-ae9e-4b04-a689-17b9d3313477	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	579eee31-ef73-4ed2-9fbd-dafd93b467c8	active	2026-01-21 14:07:48.08811+07	\N	\N	0	0
f3cb890c-1d1e-4de8-96be-d24dacc02370	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	1a390bb0-1aa9-490c-8ef3-ba17476d0bff	active	2026-01-21 14:07:48.592429+07	\N	\N	0	0
cd103ec0-6c16-46bd-a9e6-e04d973fcd64	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	de5c10a4-cb5c-4b09-ba3d-565b06c1afbf	active	2026-01-21 14:07:48.974957+07	\N	\N	0	0
599eb6e5-edb4-4b33-b0d9-e2f5a41391bd	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	c54a5db7-4ba0-4968-a847-b1756a505dc5	active	2026-01-21 14:08:33.345527+07	\N	\N	0	0
211341d8-fda7-46a5-b5fd-2f81aa4bb221	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	6390e116-fbe5-44e7-b6f3-1d51cdd29d35	active	2026-01-21 14:08:51.853239+07	\N	\N	0	0
5959036a-2277-435f-9b31-3f145db44d27	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	05f36e68-af70-4cfe-9ecf-00ad8c3997e4	active	2026-01-21 14:08:53.167033+07	\N	\N	0	0
41d5a515-1615-4a3e-bdf0-684b879188dc	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	855ad23c-ac18-4fd6-b7c2-6b647758b966	active	2026-01-21 14:09:11.239289+07	\N	\N	0	0
78c852f4-bf31-4786-a744-21f36f18434d	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	a81f2e86-c94e-4e2e-88d4-c21e8658fd77	active	2026-01-21 14:09:12.697435+07	\N	\N	0	0
a0e368f1-f287-4ff4-b729-a47e8bdfb260	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	8e407806-7822-4fe5-8ad2-792e492b0705	active	2026-01-21 14:17:01.954442+07	\N	\N	0	0
26d73a98-59b9-4fda-850f-6e583dcb73d1	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	484f84b9-616c-4d35-b64e-67f1f037c7c9	active	2026-01-21 14:17:27.548401+07	\N	\N	0	0
13d8a4da-76ba-4301-8fd3-95f6e19b3ad5	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	61d0adf0-7c9e-4937-b923-54e051c6884b	active	2026-01-21 14:37:10.283492+07	\N	\N	0	0
99da59eb-853a-432f-907b-7cf338e8867e	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	eee0bce7-855e-4a88-869c-069472e56abb	active	2026-02-04 12:05:03.549815+07	\N	\N	0	0
240cf88c-5cf2-4a76-bb94-ee27aa988e21	0d85f023-3718-4bb7-b41a-5dc122899e37	\N	23c91c19-fe1e-47ed-9a43-8c6fdcb833f3	active	2026-04-14 15:59:22.584276+07	\N	\N	0	0
\.


--
-- Name: admin_settings admin_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: credentials credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);


--
-- Name: email_verifications email_verifications_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_token_hash_key UNIQUE (token_hash);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_subject_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identities
    ADD CONSTRAINT identities_provider_subject_key UNIQUE (provider, subject);


--
-- Name: login_challenges login_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_challenges
    ADD CONSTRAINT login_challenges_pkey PRIMARY KEY (id);


--
-- Name: machine_logs machine_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.machine_logs
    ADD CONSTRAINT machine_logs_pkey PRIMARY KEY (id);


--
-- Name: machines machines_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_code_key UNIQUE (code);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: maintenance_logs maintenance_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_pkey PRIMARY KEY (id);


--
-- Name: password_resets password_resets_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_token_hash_key UNIQUE (token_hash);


--
-- Name: payments payments_order_id_key; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_order_id_key UNIQUE (order_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: payments payments_request_id_key; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_request_id_key UNIQUE (request_id);


--
-- Name: player_profiles player_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_profiles
    ADD CONSTRAINT player_profiles_pkey PRIMARY KEY (id);


--
-- Name: revoked_tokens revoked_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_pkey PRIMARY KEY (id);


--
-- Name: revoked_tokens revoked_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.revoked_tokens
    ADD CONSTRAINT revoked_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: service_plans service_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.service_plans
    ADD CONSTRAINT service_plans_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: topup_transactions topup_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.topup_transactions
    ADD CONSTRAINT topup_transactions_pkey PRIMARY KEY (id);


--
-- Name: topups topups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topups
    ADD CONSTRAINT topups_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vpn_sessions vpn_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.vpn_sessions
    ADD CONSTRAINT vpn_sessions_pkey PRIMARY KEY (id);


--
-- Name: ix_credentials_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_credentials_user_id ON public.credentials USING btree (user_id);


--
-- Name: ix_email_verifications_token_hash; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE UNIQUE INDEX ix_email_verifications_token_hash ON public.email_verifications USING btree (token_hash);


--
-- Name: ix_email_verifications_user_id; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_email_verifications_user_id ON public.email_verifications USING btree (user_id);


--
-- Name: ix_identities_provider_subject; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_identities_provider_subject ON public.identities USING btree (provider, subject);


--
-- Name: ix_identities_user_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_identities_user_id ON public.identities USING btree (user_id);


--
-- Name: ix_machine_logs_level; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_machine_logs_level ON public.machine_logs USING btree (level);


--
-- Name: ix_machine_logs_machine; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_machine_logs_machine ON public.machine_logs USING btree (machine_id);


--
-- Name: ix_machine_logs_session; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_machine_logs_session ON public.machine_logs USING btree (session_id);


--
-- Name: ix_machines_region_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_machines_region_status ON public.machines USING btree (region, status);


--
-- Name: ix_password_resets_expires_at; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_password_resets_expires_at ON public.password_resets USING btree (expires_at);


--
-- Name: ix_password_resets_token_hash; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE UNIQUE INDEX ix_password_resets_token_hash ON public.password_resets USING btree (token_hash);


--
-- Name: ix_password_resets_user_id; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_password_resets_user_id ON public.password_resets USING btree (user_id);


--
-- Name: ix_payments_created_at; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_payments_created_at ON public.payments USING btree (created_at);


--
-- Name: ix_payments_provider; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_payments_provider ON public.payments USING btree (provider);


--
-- Name: ix_payments_user_status; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_payments_user_status ON public.payments USING btree (user_id, status);


--
-- Name: ix_revoked_tokens_expires_at; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_revoked_tokens_expires_at ON public.revoked_tokens USING btree (expires_at);


--
-- Name: ix_revoked_tokens_token_hash; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE UNIQUE INDEX ix_revoked_tokens_token_hash ON public.revoked_tokens USING btree (token_hash);


--
-- Name: ix_service_plans_active; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_service_plans_active ON public.service_plans USING btree (active);


--
-- Name: ix_service_plans_code; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE UNIQUE INDEX ix_service_plans_code ON public.service_plans USING btree (code);


--
-- Name: ix_subscriptions_end_at; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_subscriptions_end_at ON public.subscriptions USING btree (end_at);


--
-- Name: ix_subscriptions_plan; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_subscriptions_plan ON public.subscriptions USING btree (plan_id);


--
-- Name: ix_subscriptions_user_status; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_subscriptions_user_status ON public.subscriptions USING btree (user_id, status);


--
-- Name: ix_topup_transactions_created_at; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_topup_transactions_created_at ON public.topup_transactions USING btree (created_at);


--
-- Name: ix_topup_transactions_status; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_topup_transactions_status ON public.topup_transactions USING btree (status);


--
-- Name: ix_topup_transactions_user_id; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_topup_transactions_user_id ON public.topup_transactions USING btree (user_id);


--
-- Name: ix_users_email; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX ix_users_email ON public.users USING btree (email);


--
-- Name: ix_users_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX ix_users_status ON public.users USING btree (status);


--
-- Name: ix_vpn_sessions_machine; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_vpn_sessions_machine ON public.vpn_sessions USING btree (machine_id);


--
-- Name: ix_vpn_sessions_status; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_vpn_sessions_status ON public.vpn_sessions USING btree (status);


--
-- Name: ix_vpn_sessions_user; Type: INDEX; Schema: public; Owner: vpn_user
--

CREATE INDEX ix_vpn_sessions_user ON public.vpn_sessions USING btree (user_id);


--
-- Name: credentials credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.credentials
    ADD CONSTRAINT credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_verifications email_verifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: login_challenges login_challenges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.login_challenges
    ADD CONSTRAINT login_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: machine_logs machine_logs_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.machine_logs
    ADD CONSTRAINT machine_logs_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE CASCADE;


--
-- Name: machine_logs machine_logs_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.machine_logs
    ADD CONSTRAINT machine_logs_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.vpn_sessions(id) ON DELETE SET NULL;


--
-- Name: maintenance_logs maintenance_logs_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.maintenance_logs
    ADD CONSTRAINT maintenance_logs_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: password_resets password_resets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.password_resets
    ADD CONSTRAINT password_resets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payments payments_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: payments payments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: player_profiles player_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.player_profiles
    ADD CONSTRAINT player_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id);


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.service_plans(id) ON DELETE RESTRICT;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: topup_transactions topup_transactions_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.topup_transactions
    ADD CONSTRAINT topup_transactions_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;


--
-- Name: topup_transactions topup_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.topup_transactions
    ADD CONSTRAINT topup_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: topups topups_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topups
    ADD CONSTRAINT topups_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vpn_sessions vpn_sessions_machine_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.vpn_sessions
    ADD CONSTRAINT vpn_sessions_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES public.machines(id) ON DELETE SET NULL;


--
-- Name: vpn_sessions vpn_sessions_subscription_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.vpn_sessions
    ADD CONSTRAINT vpn_sessions_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;


--
-- Name: vpn_sessions vpn_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: vpn_user
--

ALTER TABLE ONLY public.vpn_sessions
    ADD CONSTRAINT vpn_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: TABLE audit_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.audit_logs TO vpn_user;


--
-- Name: TABLE credentials; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.credentials TO vpn_user;


--
-- Name: TABLE identities; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.identities TO vpn_user;


--
-- Name: TABLE login_challenges; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.login_challenges TO vpn_user;


--
-- Name: TABLE machines; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.machines TO vpn_user;


--
-- Name: TABLE maintenance_logs; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.maintenance_logs TO vpn_user;


--
-- Name: TABLE player_profiles; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.player_profiles TO vpn_user;


--
-- Name: TABLE sessions; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.sessions TO vpn_user;


--
-- Name: TABLE topups; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.topups TO vpn_user;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: postgres
--

GRANT ALL ON TABLE public.users TO vpn_user;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO vpn_user;


--
-- PostgreSQL database dump complete
--

\unrestrict Qf3wlfeArRejkmZpbdzs20wMNOSotrfAVujZjTfho3mpnXM0AcE1fQTEaM5yRLS

