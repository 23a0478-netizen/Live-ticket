import { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, getDocs } from "firebase/firestore";

export default function Home() {
  const [name, setName] = useState("");
  const [count, setCount] = useState(1);
  const [tickets, setTickets] = useState([]);
  const [alreadyApplied, setAlreadyApplied] = useState(false);

  useEffect(() => {
    const deviceId = localStorage.getItem("deviceId");
    if (deviceId) {
      // 既に申込済端末かチェック
      async function check() {
        const q = query(
          collection(db, "applications"),
          where("deviceId", "==", deviceId)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          setAlreadyApplied(true);
        }
      }
      check();
    }
  }, []);

  const handleSubmit = async () => {
    const deviceId = localStorage.getItem("deviceId") || crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);

    await addDoc(collection(db, "applications"), {
      name,
      count,
      tickets,
      timestamp: serverTimestamp(),
      status: "pending",
      deviceId
    });

    window.location.href = "/done";
  };

  if (alreadyApplied) {
    return <p>この端末からは既に申し込み済みです。</p>;
  }

  return (
    <div>
      <h1>チケット申し込み</h1>
      <label>代表者名</label>
      <input value={name} onChange={e => setName(e.target.value)} />
      <label>人数</label>
      <input type="number" value={count} onChange={e => setCount(e.target.value)} min={1} />
      <label>チケット選択</label>
      <div>
        <input type="checkbox" id="A" value="A" onChange={e => {
          const v=e.target.value;
          setTickets(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v]);
        }} />
        <label htmlFor="A">Aチケット</label>
        <input type="checkbox" id="B" value="B" onChange={e => {
          const v=e.target.value;
          setTickets(prev => prev.includes(v) ? prev.filter(x=>x!==v) : [...prev, v]);
        }} />
        <label htmlFor="B">Bチケット</label>
      </div>
      <button onClick={handleSubmit}>申し込み</button>
    </div>
  );
}
export default function Done() {
  return (
    <div>
      <h1>申込完了しました</h1>
      <p>承認されるまでお待ちください。</p>
    </div>
  );
}
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import QRCode from "qrcode.react";

export default function TicketPage() {
  const [application, setApplication] = useState(null);

  useEffect(() => {
    const deviceId = localStorage.getItem("deviceId");
    if (!deviceId) return;
    const q = query(collection(db, "applications"), where("deviceId", "==", deviceId));
    return onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (docs.length > 0) {
        setApplication(docs[0]);
      }
    });
  }, []);

  if (!application) {
    return <p>申込み情報が見つかりません。</p>;
  }
  if (application.status === "pending") {
    return <p>承認待ちです。</p>;
  }
  if (application.status === "rejected") {
    return <p>申し訳ございませんが、人数の問題で申し込みできませんでした。</p>;
  }
  // status === approved
  return (
    <div>
      <h1>チケット</h1>
      <p>代表者名：{application.name}</p>
      <p>人数：{application.count}</p>
      <p>チケット種類：{application.tickets.join(", ")}</p>
      <QRCode value={application.id} size={256} />
      <button onClick={() => {/* 当日「入場」ボタン用ロジック */}}>入場</button>
    </div>
  );
}
import { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, onSnapshot, doc, updateDoc } from "firebase/firestore";

const ADMIN_PASSWORD = "YOUR_PASSWORD";  // 簡易パスワード制

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    if (!loggedIn) return;
    const unsub = onSnapshot(collection(db, "applications"), (snap) => {
      setApplications(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return unsub;
  }, [loggedIn]);

  const login = () => {
    if (password === ADMIN_PASSWORD) {
      setLoggedIn(true);
    } else {
      alert("パスワードが違います");
    }
  };

  const handleApprove = async (id) => {
    await updateDoc(doc(db, "applications", id), { status: "approved" });
  };
  const handleReject = async (id) => {
    await updateDoc(doc(db, "applications", id), { status: "rejected" });
  };

  if (!loggedIn) {
    return (
      <div>
        <label>管理者パスワード</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button onClick={login}>ログイン</button>
      </div>
    );
  }

  return (
    <div>
      <h1>申込一覧</h1>
      <table>
        <thead>
          <tr><th>代表者</th><th>人数</th><th>日時</th><th>チケット</th><th>状態</th><th>操作</th></tr>
        </thead>
        <tbody>
          {applications.map(app => (
            <tr key={app.id}>
              <td>{app.name}</td>
              <td>{app.count}</td>
              <td>{app.timestamp?.toDate().toLocaleString()}</td>
              <td>{app.tickets.join(", ")}</td>
              <td>{app.status}</td>
              <td>
                {app.status === "pending" && (
                  <>
                    <button onClick={()=>handleApprove(app.id)}>承認</button>
                    <button onClick={()=>handleReject(app.id)}>非承認</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}